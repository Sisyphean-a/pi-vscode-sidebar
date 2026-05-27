import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { RpcCommand, RpcOutputMessage, RpcResponse } from "../shared/rpc-types.ts";
import { createMessageBus, type Unsubscribe } from "./message-bus.ts";
import { dispatchProcessPayload } from "./process-manager-dispatch.ts";
import { createJsonlFramer } from "./process-manager-jsonl.ts";
import { createPendingRequestStore } from "./process-manager-pending.ts";

export { createJsonlFramer } from "./process-manager-jsonl.ts";
export { createPendingRequestStore } from "./process-manager-pending.ts";
export type { JsonlFramer } from "./process-manager-jsonl.ts";
export type { PendingRequestStore } from "./process-manager-pending.ts";

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
      for (const payload of payloads) {
        dispatchProcessPayload(payload, {
          emit: (event) => {
            this.events.emit(event);
          },
          resolvePending: (id, response) => {
            this.pending.resolve(id, response);
          },
        });
      }
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
