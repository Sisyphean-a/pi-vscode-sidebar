import { randomUUID } from "node:crypto";
import { parseSidebarCommand } from "./commands/parser.ts";
import type { RpcClient } from "./rpc-client.ts";
import type { PiRpcProcessManager, ProcessEvent } from "./process-manager.ts";
import type { RpcSessionStateStore } from "./state-store.ts";
import type {
  CommandResult,
  CommandUiItem,
  CommandUiRequest,
  HostToUiMessage,
  UiToHostMessage,
} from "../view/protocol.ts";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import { findBuiltinSidebarCommand } from "../shared/sidebar-commands.ts";
import type {
  RpcCommand,
  RpcExtensionUIResponse,
  RpcSlashCommand,
  RpcSessionState,
  RpcSessionTreeNode,
} from "../shared/rpc-types.ts";
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
type PendingCommandUiKind = "fork" | "model" | "resume" | "tree";

interface PendingCommandUiRequest {
  kind: PendingCommandUiKind;
  rawInput: string;
}

export function createSidebarController(options: SidebarControllerOptions): SidebarController {
  return new SidebarControllerImpl(options);
}

class SidebarControllerImpl implements SidebarController {
  private sink: ((message: HostToUiMessage) => void) | undefined;
  private readonly unsubscribe: () => void;
  private readonly extensionUiTimeoutMs: number;
  private hasLoadedSlashCommands = false;
  private readonly availableSlashCommands = new Map<string, RpcSlashCommand>();
  private readonly pendingExtensionUiRequests = new Map<string, NodeJS.Timeout>();
  private readonly pendingCommandUiRequests = new Map<string, PendingCommandUiRequest>();

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
      case "run_command":
        await this.onRunCommand(message.rawInput, message.correlationId);
        return;
      case "respond_command_ui":
        await this.onCommandUiResponse(message.requestId, message.payload, message.correlationId);
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

  private async onRunCommand(rawInput: string, correlationId: string | undefined): Promise<void> {
    const parsed = parseSidebarCommand(rawInput);
    if (!parsed) {
      this.emitCommandResult({ status: "error", restoreInput: rawInput });
      return;
    }

    if (await this.runDirectSidebarCommand(parsed, correlationId)) return;
    if (await this.openSidebarCommandUi(parsed, correlationId)) return;
    if (await this.runDynamicSidebarCommand(parsed, correlationId)) return;

    this.emitCommandResult({
      status: "error",
      message: `未实现命令：/${parsed.name}`,
      restoreInput: rawInput,
    });
  }

  private async runDirectSidebarCommand(
    parsed: ReturnType<typeof parseSidebarCommand>,
    correlationId: string | undefined,
  ): Promise<boolean> {
    if (!parsed) return false;
    if (parsed.name === "new") {
      await this.onSimpleCommand({ type: "new_session" }, "idle", correlationId);
      return true;
    }
    if (parsed.name === "compact") {
      await this.onSimpleCommand(
        { type: "compact", customInstructions: parsed.tail || undefined },
        "idle",
        correlationId,
      );
      return true;
    }
    if (parsed.name === "clone") {
      await this.onSimpleCommand({ type: "clone" }, "idle", correlationId);
      return true;
    }
    if (parsed.name === "name") {
      if (!parsed.tail) {
        this.emitCommandError("会话名称不能为空", parsed.rawInput);
        return true;
      }
      await this.onSimpleCommand(
        { type: "set_session_name", name: parsed.tail },
        "idle",
        correlationId,
      );
      return true;
    }
    if (parsed.name === "copy") {
      await this.onCopyCommand(correlationId, parsed.rawInput);
      return true;
    }
    if (parsed.name === "export") {
      await this.onExportCommand(parsed.tail || undefined, correlationId, parsed.rawInput);
      return true;
    }
    return false;
  }

  private async runDynamicSidebarCommand(
    parsed: ReturnType<typeof parseSidebarCommand>,
    correlationId: string | undefined,
  ): Promise<boolean> {
    if (!parsed) return false;
    if (findBuiltinSidebarCommand(parsed.name)) return false;
    const command = await this.findDynamicSlashCommand(parsed.name, correlationId);
    if (!command) return false;
    await this.onPromptSlashCommand(parsed.rawInput, correlationId);
    return true;
  }

  private async openSidebarCommandUi(
    parsed: ReturnType<typeof parseSidebarCommand>,
    correlationId: string | undefined,
  ): Promise<boolean> {
    if (!parsed) return false;
    if (parsed.name === "resume") {
      await this.openResumeCommandUi(parsed.rawInput);
      return true;
    }
    if (parsed.name === "model") {
      await this.openModelCommandUi(parsed.rawInput, correlationId);
      return true;
    }
    if (parsed.name === "fork") {
      await this.openForkCommandUi(parsed.rawInput, correlationId);
      return true;
    }
    if (parsed.name === "tree") {
      await this.openTreeCommandUi(parsed.rawInput, correlationId);
      return true;
    }
    return false;
  }

  private async openResumeCommandUi(rawInput: string): Promise<void> {
    const sessions = (await this.options.listRecentSessions?.()) ?? [];
    if (sessions.length === 0) {
      this.emitCommandError("没有可恢复的会话", rawInput);
      return;
    }

    const requestId = createCommandUiRequestId();
    this.pendingCommandUiRequests.set(requestId, { kind: "resume", rawInput });
    this.emitCommandUiRequest(requestId, "session_list", sessions.map(toSessionCommandUiItem));
  }

  private async openModelCommandUi(
    rawInput: string,
    correlationId: string | undefined,
  ): Promise<void> {
    const response = await this.sendRpcCommand({ type: "get_available_models" }, correlationId);
    if (!response.success) {
      this.reportCommandFailure(response, correlationId);
      this.emitCommandError(response.error ?? "获取模型失败", rawInput);
      return;
    }

    const items = readModelCommandUiItems(response.data);
    if (items.length === 0) {
      this.emitCommandError("没有可选模型", rawInput);
      return;
    }

    const requestId = createCommandUiRequestId();
    this.pendingCommandUiRequests.set(requestId, { kind: "model", rawInput });
    this.emitCommandUiRequest(requestId, "model_list", items);
  }

  private async openForkCommandUi(
    rawInput: string,
    correlationId: string | undefined,
  ): Promise<void> {
    const response = await this.sendRpcCommand({ type: "get_fork_messages" }, correlationId);
    if (!response.success) {
      this.reportCommandFailure(response, correlationId);
      this.emitCommandError(response.error ?? "获取分叉列表失败", rawInput);
      return;
    }

    const items = readForkCommandUiItems(response.data);
    if (items.length === 0) {
      this.emitCommandError("没有可分叉的用户消息", rawInput);
      return;
    }

    const requestId = createCommandUiRequestId();
    this.pendingCommandUiRequests.set(requestId, { kind: "fork", rawInput });
    this.emitCommandUiRequest(requestId, "message_list", items);
  }

  private async openTreeCommandUi(
    rawInput: string,
    correlationId: string | undefined,
  ): Promise<void> {
    const response = await this.sendRpcCommand({ type: "get_session_tree" }, correlationId);
    if (!response.success) {
      this.reportCommandFailure(response, correlationId);
      this.emitCommandError(response.error ?? "获取会话树失败", rawInput);
      return;
    }

    const items = readTreeCommandUiItems(response.data);
    if (items.length === 0) {
      this.emitCommandError("没有可切换的树节点", rawInput);
      return;
    }

    const requestId = createCommandUiRequestId();
    this.pendingCommandUiRequests.set(requestId, { kind: "tree", rawInput });
    this.emitCommandUiRequest(requestId, "session_tree", items);
  }

  private async onCopyCommand(correlationId: string | undefined, rawInput: string): Promise<void> {
    const response = await this.sendRpcCommand({ type: "get_last_assistant_text" }, correlationId);
    if (!response.success) {
      this.reportCommandFailure(response, correlationId);
      this.emitCommandError(response.error ?? "获取最后一条助手消息失败", rawInput);
      return;
    }

    const copyText = readLastAssistantText(response.data);
    if (!copyText) {
      this.emitCommandError("没有可复制的助手消息", rawInput);
      return;
    }

    this.emitCommandResult({
      status: "success",
      message: "已复制",
      copyText,
    });
  }

  private async onExportCommand(
    outputPath: string | undefined,
    correlationId: string | undefined,
    rawInput: string,
  ): Promise<void> {
    const response = await this.sendRpcCommand({ type: "export_html", outputPath }, correlationId);
    if (!response.success) {
      this.reportCommandFailure(response, correlationId);
      this.emitCommandError(response.error ?? "导出失败", rawInput);
      return;
    }

    const path = readExportPath(response.data);
    this.emitCommandResult({
      status: "success",
      message: path ? `已导出：${path}` : "已导出",
    });
  }

  private async onCommandUiResponse(
    requestId: string,
    payload: unknown,
    correlationId: string | undefined,
  ): Promise<void> {
    const pending = this.pendingCommandUiRequests.get(requestId);
    if (!pending) return;
    this.pendingCommandUiRequests.delete(requestId);

    const selectedId = readSelectedCommandUiId(payload);
    if (!selectedId && pending.kind !== "model") return;

    if (pending.kind === "resume" && selectedId) {
      await this.onSimpleCommand(
        { type: "switch_session", sessionPath: selectedId },
        "idle",
        correlationId,
      );
      return;
    }

    if (pending.kind === "model") {
      const modelSelection = readModelSelection(payload);
      if (!modelSelection) {
        this.emitCommandError("模型选择无效", pending.rawInput);
        return;
      }
      await this.onSimpleCommand(
        { type: "set_model", provider: modelSelection.provider, modelId: modelSelection.modelId },
        this.options.stateStore.snapshot().phase,
        correlationId,
      );
      return;
    }

    if (pending.kind === "fork" && selectedId) {
      await this.onSimpleCommand({ type: "fork", entryId: selectedId }, "idle", correlationId);
      return;
    }

    if (pending.kind === "tree" && selectedId) {
      await this.onSimpleCommand(
        { type: "navigate_session_tree", entryId: selectedId },
        "idle",
        correlationId,
      );
    }
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
    if (shouldReplayMessagesAfterCommand(command.type)) {
      await this.replayMessages(correlationId, true);
    }
  }

  private async onUiReady(correlationId: string | undefined): Promise<void> {
    await this.options.ensureStarted();
    await this.syncState();
    await this.replayMessages(correlationId, true);
    await this.refreshAvailableSlashCommands(correlationId, true);
  }

  private async onRpcQuery(command: RpcCommand, correlationId: string | undefined): Promise<void> {
    const response = await this.sendRpcCommand(command, correlationId);
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

  private async onPromptSlashCommand(
    rawInput: string,
    correlationId: string | undefined,
  ): Promise<void> {
    await this.options.ensureStarted();
    const response = await this.options.rpcClient.send(
      withCommandId({ type: "prompt", message: rawInput }, correlationId),
    );
    this.reportCommandFailure(response, correlationId);
    if (response.success) {
      await this.syncState();
    }
  }

  private async findDynamicSlashCommand(
    name: string,
    correlationId: string | undefined,
  ): Promise<RpcSlashCommand | undefined> {
    if (!this.availableSlashCommands.has(name) || !this.hasLoadedSlashCommands) {
      await this.refreshAvailableSlashCommands(correlationId, false);
    }
    return this.availableSlashCommands.get(name);
  }

  private async refreshAvailableSlashCommands(
    correlationId: string | undefined,
    emitEvent: boolean,
  ): Promise<void> {
    const response = await this.sendRpcCommand({ type: "get_commands" }, correlationId);
    this.reportCommandFailure(response, correlationId);
    if (!response.success) return;
    this.storeAvailableSlashCommands(readSlashCommands(response.data));
    if (!emitEvent) return;
    this.emit({
      type: "event",
      data: { type: "query_result", command: "get_commands", data: response.data, correlationId },
    });
  }

  private storeAvailableSlashCommands(commands: RpcSlashCommand[]): void {
    this.availableSlashCommands.clear();
    for (const command of commands) {
      this.availableSlashCommands.set(command.name, command);
    }
    this.hasLoadedSlashCommands = true;
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

  private emitCommandResult(data: CommandResult): void {
    this.emit({ type: "command_result", data });
  }

  private emitCommandUiRequest(
    id: string,
    kind: CommandUiRequest["kind"],
    items: CommandUiItem[],
  ): void {
    this.emit({
      type: "command_ui_request",
      data: { id, kind, items },
    });
  }

  private emitCommandError(message: string, restoreInput: string): void {
    this.emitCommandResult({
      status: "error",
      message,
      restoreInput,
    });
  }

  private async sendRpcCommand(command: RpcCommand, correlationId: string | undefined) {
    await this.options.ensureStarted();
    return this.options.rpcClient.send(withCommandId(command, correlationId));
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

function shouldReplayMessagesAfterCommand(commandType: RpcCommand["type"]): boolean {
  return (
    commandType === "new_session" ||
    commandType === "switch_session" ||
    commandType === "clone" ||
    commandType === "fork" ||
    commandType === "navigate_session_tree"
  );
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

function createCommandUiRequestId(): string {
  return `cmd-ui-${randomUUID()}`;
}

function toSessionCommandUiItem(session: RecentSessionSummary): CommandUiRequest["items"][number] {
  return {
    id: session.sessionPath,
    label: session.title,
    detail: session.updatedAt,
    payload: { selectedId: session.sessionPath },
  };
}

function readSelectedCommandUiId(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const selectedId = (payload as { selectedId?: unknown }).selectedId;
  return typeof selectedId === "string" && selectedId ? selectedId : undefined;
}

function readModelSelection(payload: unknown): { provider: string; modelId: string } | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const provider = (payload as { provider?: unknown }).provider;
  const modelId = (payload as { modelId?: unknown }).modelId;
  if (typeof provider !== "string" || !provider) return undefined;
  if (typeof modelId !== "string" || !modelId) return undefined;
  return { provider, modelId };
}

function readModelCommandUiItems(data: unknown): CommandUiItem[] {
  const models = Array.isArray((data as { models?: unknown[] } | undefined)?.models)
    ? (data as { models: unknown[] }).models
    : [];
  return models.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const provider = (entry as { provider?: unknown }).provider;
    const id = (entry as { id?: unknown }).id;
    if (typeof provider !== "string" || !provider) return [];
    if (typeof id !== "string" || !id) return [];
    const name = (entry as { name?: unknown }).name;
    return [
      {
        id: `${provider}/${id}`,
        label: typeof name === "string" && name ? name : id,
        detail: provider,
        payload: { provider, modelId: id },
      },
    ];
  });
}

function readForkCommandUiItems(data: unknown): CommandUiItem[] {
  const messages = Array.isArray((data as { messages?: unknown[] } | undefined)?.messages)
    ? (data as { messages: unknown[] }).messages
    : [];
  return messages.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const entryId = (entry as { entryId?: unknown }).entryId;
    const text = (entry as { text?: unknown }).text;
    if (typeof entryId !== "string" || !entryId) return [];
    if (typeof text !== "string" || !text) return [];
    return [
      {
        id: entryId,
        label: truncateLabel(text),
        payload: { selectedId: entryId },
      },
    ];
  });
}

function readTreeCommandUiItems(data: unknown): CommandUiItem[] {
  const nodes = Array.isArray((data as { nodes?: RpcSessionTreeNode[] } | undefined)?.nodes)
    ? (data as { nodes: RpcSessionTreeNode[] }).nodes
    : [];
  return nodes.map((node) => ({
    id: node.entryId,
    label: node.label?.trim() || truncateLabel(node.previewText),
    detail: node.label?.trim() ? truncateLabel(node.previewText) : undefined,
    depth: node.depth,
    active: node.isActive,
    payload: { selectedId: node.entryId },
  }));
}

function readSlashCommands(data: unknown): RpcSlashCommand[] {
  const commands = (data as { commands?: unknown } | undefined)?.commands;
  if (!Array.isArray(commands)) return [];
  return commands.filter((command): command is RpcSlashCommand => {
    if (!command || typeof command !== "object" || Array.isArray(command)) return false;
    const record = command as Record<string, unknown>;
    return (
      typeof record.name === "string" &&
      typeof record.source === "string" &&
      typeof record.sourceInfo === "object" &&
      record.sourceInfo !== null
    );
  });
}

function readLastAssistantText(data: unknown): string | undefined {
  const text = (data as { text?: unknown } | undefined)?.text;
  return typeof text === "string" && text ? text : undefined;
}

function readExportPath(data: unknown): string | undefined {
  const path = (data as { path?: unknown } | undefined)?.path;
  return typeof path === "string" && path ? path : undefined;
}

function truncateLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 72)}...`;
}
