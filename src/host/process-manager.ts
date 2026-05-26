import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  isAgentEventLike,
  isRpcExtensionUiRequest,
  isRpcResponse,
  type RpcCommand,
  type RpcOutputMessage,
  type RpcResponse,
} from "../shared/rpc-types.ts";
import { createMessageBus, type Unsubscribe } from "./message-bus.ts";

export interface JsonlFramer {
  push(chunk: Buffer | string): unknown[];
}

export interface PendingRequestStore {
  register(id: string, timeoutMs: number): Promise<unknown>;
  resolve(id: string, payload: unknown): boolean;
  reject(id: string, error: Error): boolean;
  rejectAll(error: Error): void;
}

export interface StartProcessOptions {
  executable: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export type ProcessEvent =
  | RpcOutputMessage
  | { type: "stderr"; message: string }
  | { type: "rpc_command_sent"; id: string; command: string; payload: RpcCommand & { id: string } }
  | { type: "rpc_response"; id?: string; command: string; success: boolean; payload: RpcResponse }
  | { type: "process_exit"; code: number | null; signal: NodeJS.Signals | null };

export interface PiRpcProcessManager {
  start(options: StartProcessOptions): Promise<void>;
  stop(): Promise<void>;
  send(command: RpcCommand, timeoutMs: number): Promise<RpcResponse>;
  onEvent(listener: (event: ProcessEvent) => void): Unsubscribe;
  isRunning(): boolean;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
}

export function createJsonlFramer(): JsonlFramer {
  let buffer = "";

  return {
    push(chunk) {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      return takeJsonlEntries(
        () => buffer,
        (nextBuffer) => {
          buffer = nextBuffer;
        },
      );
    },
  };
}

function takeJsonlEntries(read: () => string, write: (value: string) => void): unknown[] {
  const payloads: unknown[] = [];
  let working = read();

  while (true) {
    const newlineIndex = working.indexOf("\n");
    if (newlineIndex < 0) break;

    const line = working.slice(0, newlineIndex).replace(/\r$/, "");
    working = working.slice(newlineIndex + 1);
    if (!line.trim()) continue;

    try {
      payloads.push(JSON.parse(line) as unknown);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSONL payload: ${detail}`);
    }
  }

  write(working);
  return payloads;
}

export function createPendingRequestStore(): PendingRequestStore {
  const pending = new Map<string, PendingRequest>();

  return {
    register(id, timeoutMs) {
      if (pending.has(id)) {
        throw new Error(`Duplicate RPC request id: ${id}`);
      }

      return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`RPC timeout for request ${id}`));
        }, timeoutMs);

        pending.set(id, { resolve, reject, timeout });
      });
    },
    resolve(id, payload) {
      return complete(pending, id, payload, undefined);
    },
    reject(id, error) {
      return complete(pending, id, undefined, error);
    },
    rejectAll(error) {
      for (const id of pending.keys()) {
        complete(pending, id, undefined, error);
      }
    },
  };
}

function complete(
  pending: Map<string, PendingRequest>,
  id: string,
  payload: unknown,
  error: Error | undefined,
): boolean {
  const entry = pending.get(id);
  if (!entry) return false;

  clearTimeout(entry.timeout);
  pending.delete(id);
  if (error) entry.reject(error);
  else entry.resolve(payload);
  return true;
}

export function createPiRpcProcessManager(): PiRpcProcessManager {
  return new NodePiRpcProcessManager();
}

class NodePiRpcProcessManager implements PiRpcProcessManager {
  private readonly events = createMessageBus<ProcessEvent>();
  private readonly pending = createPendingRequestStore();
  private readonly framer = createJsonlFramer();
  private child: ChildProcessWithoutNullStreams | undefined;

  async start(options: StartProcessOptions): Promise<void> {
    if (this.child) return;
    const child = spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.bindStdout(child);
    this.bindStderr(child);
    this.bindLifecycle(child);
    await waitForProcessReady(child).catch((error) => {
      if (this.child === child) this.child = undefined;
      throw error;
    });
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = undefined;
    await new Promise<void>((resolve) => {
      child.once("close", () => resolve());
      child.kill();
    });
  }

  isRunning(): boolean {
    return !!this.child && !this.child.killed;
  }

  onEvent(listener: (event: ProcessEvent) => void): Unsubscribe {
    return this.events.subscribe(listener);
  }

  async send(command: RpcCommand, timeoutMs: number): Promise<RpcResponse> {
    const child = this.child;
    if (!child) throw new Error("Pi RPC process is not running.");

    const id = command.id ?? randomUUID();
    const payload = { ...command, id };
    const pending = this.pending.register(id, timeoutMs).then((value) => value as RpcResponse);

    this.events.emit({ type: "rpc_command_sent", id, command: command.type, payload });
    child.stdin.write(`${JSON.stringify(payload)}\n`);
    return pending;
  }

  private bindStdout(child: ChildProcessWithoutNullStreams): void {
    child.stdout.on("data", (chunk) => {
      const payloads = this.framer.push(chunk);
      for (const payload of payloads) this.onPayload(payload);
    });
  }

  private bindStderr(child: ChildProcessWithoutNullStreams): void {
    child.stderr.on("data", (chunk) => {
      this.events.emit({ type: "stderr", message: chunk.toString("utf8") });
    });
  }

  private bindLifecycle(child: ChildProcessWithoutNullStreams): void {
    child.on("error", (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.events.emit({ type: "stderr", message: `Pi RPC process error: ${detail}` });
    });
    child.once("close", (code, signal) => {
      if (this.child === child) this.child = undefined;
      this.pending.rejectAll(new Error("Pi RPC process exited."));
      this.events.emit({ type: "process_exit", code, signal });
    });
  }

  private onPayload(payload: unknown): void {
    if (isRpcResponse(payload)) {
      this.events.emit({
        type: "rpc_response",
        id: payload.id,
        command: payload.command,
        success: payload.success,
        payload,
      });
      if (payload.id) this.pending.resolve(payload.id, payload);
      else this.events.emit(payload);
      return;
    }
    if (isRpcExtensionUiRequest(payload) || isAgentEventLike(payload)) {
      this.events.emit(payload);
      return;
    }
    this.events.emit({
      type: "stderr",
      message: `Unknown RPC payload: ${JSON.stringify(payload)}`,
    });
  }
}

function waitForProcessReady(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onSpawn = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      child.off("spawn", onSpawn);
      child.off("error", onError);
    };

    child.once("spawn", onSpawn);
    child.once("error", onError);
  });
}
