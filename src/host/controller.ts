import type { RpcClient } from "./rpc-client.ts";
import type { PiRpcProcessManager, ProcessEvent } from "./process-manager.ts";
import type { RpcSessionStateStore } from "./state-store.ts";
import type { HostToUiMessage, UiToHostMessage } from "../view/protocol.ts";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import type { RpcCommand, RpcExtensionUIResponse, RpcSessionState } from "../shared/rpc-types.ts";
import type { Logger } from "./logger.ts";

export interface SidebarController {
  connect(sink: (message: HostToUiMessage) => void): () => void;
  handleUiMessage(message: UiToHostMessage): Promise<void>;
  dispose(): Promise<void>;
}

export interface SidebarControllerOptions {
  processManager: PiRpcProcessManager;
  rpcClient: RpcClient;
  stateStore: RpcSessionStateStore;
  ensureStarted(): Promise<void>;
  listRecentSessions?(): Promise<RecentSessionSummary[]>;
  onRpcState?(state: RpcSessionState): Promise<void> | void;
  extensionUiTimeoutMs?: number;
  logger?: Logger;
}

const DEFAULT_EXTENSION_UI_TIMEOUT_MS = 120000;

export function createSidebarController(options: SidebarControllerOptions): SidebarController {
  return new SidebarControllerImpl(options);
}

class SidebarControllerImpl implements SidebarController {
  private sink: ((message: HostToUiMessage) => void) | undefined;
  private readonly unsubscribe: () => void;
  private readonly extensionUiTimeoutMs: number;
  private readonly pendingExtensionUiRequests = new Map<string, NodeJS.Timeout>();

  constructor(private readonly options: SidebarControllerOptions) {
    this.extensionUiTimeoutMs = normalizeTimeoutMs(options.extensionUiTimeoutMs);
    this.unsubscribe = this.options.processManager.onEvent((event) => {
      void this.onProcessEvent(event);
    });
  }

  connect(sink: (message: HostToUiMessage) => void): () => void {
    this.sink = sink;
    void this.syncState().catch((error) => {
      this.reportBackgroundSyncFailure(error);
    });
    return () => {
      if (this.sink === sink) this.sink = undefined;
    };
  }

  async handleUiMessage(message: UiToHostMessage): Promise<void> {
    this.options.logger?.debug({
      scope: "controller",
      correlationId: message.correlationId,
      message: `ui message received: ${message.type}`,
    });

    switch (message.type) {
      case "ui_ready":
        await this.onUiReady(message.correlationId);
        return;
      case "send_prompt":
        await this.onSendPrompt(message.text, message.images, message.correlationId);
        return;
      case "abort":
        await this.onSimpleCommand({ type: "abort" }, "idle", message.correlationId);
        return;
      case "new_session":
        await this.onSimpleCommand({ type: "new_session" }, "idle", message.correlationId);
        return;
      case "switch_session":
        await this.onSimpleCommand(
          { type: "switch_session", sessionPath: message.sessionPath },
          "idle",
          message.correlationId,
        );
        return;
      case "set_session_name":
        await this.onSimpleCommand(
          { type: "set_session_name", name: message.name },
          "idle",
          message.correlationId,
        );
        return;
      case "export_html":
        await this.onRpcQuery(
          { type: "export_html", outputPath: message.outputPath },
          message.correlationId,
        );
        return;
      case "get_available_models":
        await this.onRpcQuery({ type: "get_available_models" }, message.correlationId);
        return;
      case "get_session_stats":
        await this.onRpcQuery({ type: "get_session_stats" }, message.correlationId);
        return;
      case "set_model":
        await this.onSimpleCommand(
          { type: "set_model", provider: message.provider, modelId: message.modelId },
          this.options.stateStore.snapshot().phase,
          message.correlationId,
        );
        return;
      case "set_thinking_level":
        await this.onSimpleCommand(
          { type: "set_thinking_level", level: message.level },
          "idle",
          message.correlationId,
        );
        return;
      case "respond_extension_ui":
        await this.onExtensionUiResponse(message.requestId, message.payload);
        return;
    }
  }

  async dispose(): Promise<void> {
    this.unsubscribe();
    this.clearAllExtensionUiTimers();
    await this.options.processManager.stop();
  }

  private async onSendPrompt(
    text: string,
    images: Array<{ path: string }> | undefined,
    correlationId: string | undefined,
  ): Promise<void> {
    const phase = this.options.stateStore.snapshot().phase;
    if (phase !== "idle") {
      this.emit({
        type: "error",
        scope: "ui",
        message: `Cannot send prompt while phase is "${phase}".`,
      });
      return;
    }

    await this.options.ensureStarted();
    this.options.stateStore.markStreaming();
    this.emitState();
    const response = await this.options.rpcClient.send(
      withCommandId({ type: "prompt", message: text, images }, correlationId),
    );
    this.reportCommandFailure(response, correlationId);
  }

  private async onSimpleCommand(
    command: RpcCommand,
    phase: "idle" | "streaming" | "awaiting_extension_ui" | "process_dead",
    correlationId: string | undefined,
  ): Promise<void> {
    await this.options.ensureStarted();
    if (phase === "idle") this.options.stateStore.markIdle();
    const response = await this.options.rpcClient.send(withCommandId(command, correlationId));
    this.reportCommandFailure(response, correlationId);
    await this.syncState();
    if (response.success && shouldEmitCommandResult(command.type)) {
      this.emit({
        type: "event",
        data: { type: "query_result", command: command.type, data: response.data, correlationId },
      });
    }
    if (command.type === "new_session" || command.type === "switch_session") {
      await this.replayMessages(correlationId, true);
    }
  }

  private async onUiReady(correlationId: string | undefined): Promise<void> {
    await this.options.ensureStarted();
    await this.syncState();
    await this.replayMessages(correlationId, true);
  }

  private async onRpcQuery(command: RpcCommand, correlationId: string | undefined): Promise<void> {
    await this.options.ensureStarted();
    const response = await this.options.rpcClient.send(withCommandId(command, correlationId));
    this.reportCommandFailure(response, correlationId);
    if (!response.success) return;
    this.emit({
      type: "event",
      data: { type: "query_result", command: command.type, data: response.data, correlationId },
    });
    await this.syncState();
  }

  private async replayMessages(correlationId: string | undefined, replace: boolean): Promise<void> {
    const response = await this.options.rpcClient.send(
      withCommandId({ type: "get_messages" }, correlationId),
    );
    if (!response.success) {
      if (isUnsupportedGetMessagesError(response.error)) return;
      this.reportCommandFailure(response, correlationId);
      return;
    }
    this.emit({
      type: "event",
      data: {
        type: "query_result",
        command: "get_messages",
        data: response.data,
        correlationId,
        replace,
      },
    });
  }

  private async onExtensionUiResponse(requestId: string, payload: unknown): Promise<void> {
    this.clearExtensionUiTimer(requestId);
    await this.options.ensureStarted();
    const responsePayload = normalizeExtensionUiResponse(requestId, payload);
    const response = await this.options.rpcClient.sendExtensionUiResponse(responsePayload);
    this.reportCommandFailure(response);
    this.options.stateStore.markStreaming();
    this.emitState();
  }

  private async onProcessEvent(event: ProcessEvent): Promise<void> {
    if (event.type === "stderr") {
      this.options.logger?.warn({
        scope: "controller",
        message: "rpc stderr forwarded to ui",
        details: { message: event.message },
      });
      this.emit({ type: "error", scope: "rpc", message: event.message });
      return;
    }
    if (event.type === "process_exit") {
      this.options.logger?.error({
        scope: "controller",
        message: "rpc process exit observed",
        details: { code: event.code ?? null, signal: event.signal ?? null },
      });
      this.options.stateStore.markProcessDead(`RPC process exited (${event.code ?? "unknown"})`);
      this.emitState();
      return;
    }
    if (event.type === "extension_ui_request") {
      this.options.logger?.debug({
        scope: "controller",
        correlationId: event.id,
        message: `extension ui request: ${event.method}`,
      });
      if (isBlockingExtensionUiMethod(event.method)) {
        this.options.stateStore.markAwaitingExtensionUi();
        this.emitState();
        this.scheduleExtensionUiTimeout(event.id);
      }
      this.emit({ type: "extension_ui_request", data: event });
      return;
    }

    if (event.type === "agent_start" || event.type === "message_update") {
      this.options.stateStore.markStreaming();
      this.emitState();
    } else if (event.type === "agent_end") {
      this.clearAllExtensionUiTimers();
      this.options.stateStore.markIdle();
      this.emitState();
      await this.syncState();
    }
    this.emit({ type: "event", data: event });
  }

  private async syncState(): Promise<void> {
    const rpcState = await this.options.rpcClient.getState().catch(() => undefined);
    if (rpcState) await this.options.onRpcState?.(rpcState);
    const recentSessions = await this.options.listRecentSessions?.();
    this.emit({
      type: "state",
      data: {
        view: this.options.stateStore.snapshot(),
        rpc: rpcState,
        recentSessions,
      },
    });
  }

  private emitState(): void {
    this.emit({
      type: "state",
      data: {
        view: this.options.stateStore.snapshot(),
      },
    });
  }

  private emit(message: HostToUiMessage): void {
    this.sink?.(message);
  }

  private reportBackgroundSyncFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.options.logger?.error({
      scope: "controller",
      message: "failed to sync sidebar state",
      details: { error: message },
    });
    this.emit({
      type: "error",
      scope: "ui",
      message: `同步侧边栏状态失败：${message}`,
    });
  }

  private reportCommandFailure(
    response: { success: boolean; error?: string },
    correlationId?: string,
  ): void {
    if (response.success) return;
    const cidSuffix = correlationId ? ` (correlationId: ${correlationId})` : "";
    this.options.logger?.error({
      scope: "controller",
      correlationId,
      message: response.error ?? "RPC command failed.",
    });
    this.emit({
      type: "error",
      scope: "rpc",
      message: `${response.error ?? "RPC command failed."}${cidSuffix}`,
    });
  }

  private scheduleExtensionUiTimeout(requestId: string): void {
    this.clearExtensionUiTimer(requestId);
    const timer = setTimeout(() => {
      void this.onExtensionUiTimeout(requestId);
    }, this.extensionUiTimeoutMs);
    this.pendingExtensionUiRequests.set(requestId, timer);
  }

  private async onExtensionUiTimeout(requestId: string): Promise<void> {
    this.pendingExtensionUiRequests.delete(requestId);
    this.emit({
      type: "error",
      scope: "rpc",
      message: `Extension UI request timed out: ${requestId}`,
    });
    const response = await this.options.rpcClient.sendExtensionUiResponse({
      type: "extension_ui_response",
      id: requestId,
      cancelled: true,
    });
    this.reportCommandFailure(response);
    await this.syncState();
  }

  private clearExtensionUiTimer(requestId: string): void {
    const timer = this.pendingExtensionUiRequests.get(requestId);
    if (!timer) return;
    clearTimeout(timer);
    this.pendingExtensionUiRequests.delete(requestId);
  }

  private clearAllExtensionUiTimers(): void {
    for (const timer of this.pendingExtensionUiRequests.values()) {
      clearTimeout(timer);
    }
    this.pendingExtensionUiRequests.clear();
  }
}

function shouldEmitCommandResult(commandType: RpcCommand["type"]): boolean {
  return commandType === "set_model" || commandType === "set_thinking_level";
}

function isBlockingExtensionUiMethod(method: string): boolean {
  return method === "select" || method === "confirm" || method === "input" || method === "editor";
}

function normalizeExtensionUiResponse(requestId: string, payload: unknown): RpcExtensionUIResponse {
  if (payload === null || payload === undefined) {
    return { type: "extension_ui_response", id: requestId, cancelled: true };
  }
  if (typeof payload === "boolean") {
    return { type: "extension_ui_response", id: requestId, confirmed: payload };
  }
  return { type: "extension_ui_response", id: requestId, value: String(payload) };
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_EXTENSION_UI_TIMEOUT_MS;
  }
  return Math.max(1000, Math.trunc(timeoutMs));
}

function withCommandId(command: RpcCommand, correlationId: string | undefined): RpcCommand {
  if (!correlationId || command.id) return command;
  return { ...command, id: correlationId };
}

function isUnsupportedGetMessagesError(error: string | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("unknown rpc command") ||
    normalized.includes("unknown command") ||
    normalized.includes("unsupported")
  );
}
