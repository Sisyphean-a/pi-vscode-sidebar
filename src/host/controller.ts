import {
  createSidebarControllerWiring,
  type SidebarControllerWiring,
} from "./controller-wiring.ts";
import type { RpcClient } from "./rpc-client.ts";
import type { PiRpcProcessManager } from "./process-manager.ts";
import type { RpcSessionStateStore } from "./state-store.ts";
import type {
  CommandResult,
  CommandUiItem,
  CommandUiRequest,
  HostToUiMessage,
  UiToHostMessage,
} from "../view/protocol.ts";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import type { RpcSessionState } from "../shared/rpc-types.ts";
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

export function createSidebarController(options: SidebarControllerOptions): SidebarController {
  return new SidebarControllerImpl(options);
}

class SidebarControllerImpl implements SidebarController {
  private sink: ((message: HostToUiMessage) => void) | undefined;
  private readonly commandRoutingFlow: SidebarControllerWiring["commandRoutingFlow"];
  private readonly commandUiFlow: SidebarControllerWiring["commandUiFlow"];
  private readonly directCommandFlow: SidebarControllerWiring["directCommandFlow"];
  private readonly processEventFlow: SidebarControllerWiring["processEventFlow"];
  private readonly rpcFlow: SidebarControllerWiring["rpcFlow"];
  private readonly runtimeFlow: SidebarControllerWiring["runtimeFlow"];
  private readonly uiMessageRouter: SidebarControllerWiring["uiMessageRouter"];
  private readonly unsubscribe: SidebarControllerWiring["unsubscribe"];

  constructor(private readonly options: SidebarControllerOptions) {
    const wiring = createSidebarControllerWiring({
      controllerOptions: this.options,
      emit: (message) => {
        this.emit(message);
      },
      emitCommandError: (message, restoreInput) => {
        this.emitCommandError(message, restoreInput);
      },
      emitCommandResult: (data) => {
        this.emitCommandResult(data);
      },
      emitCommandUiRequest: (id, kind, items) => {
        this.emitCommandUiRequest(id, kind, items);
      },
      reportCommandFailure: (response, correlationId) => {
        this.reportCommandFailure(response, correlationId);
      },
    });
    this.commandRoutingFlow = wiring.commandRoutingFlow;
    this.commandUiFlow = wiring.commandUiFlow;
    this.directCommandFlow = wiring.directCommandFlow;
    this.processEventFlow = wiring.processEventFlow;
    this.rpcFlow = wiring.rpcFlow;
    this.runtimeFlow = wiring.runtimeFlow;
    this.uiMessageRouter = wiring.uiMessageRouter;
    this.unsubscribe = wiring.unsubscribe;
  }

  connect(sink: (message: HostToUiMessage) => void): () => void {
    this.sink = sink;
    void this.runtimeFlow.syncState().catch((error) => {
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
    await this.uiMessageRouter.handle(message);
  }

  async dispose(): Promise<void> {
    this.unsubscribe();
    this.processEventFlow.dispose();
    await this.options.processManager.stop();
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
}
