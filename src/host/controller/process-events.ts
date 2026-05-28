import { createControllerExtensionUiFlow } from "./ui/extension-flow.ts";
import type { Logger } from "../logger.ts";
import type { ProcessEvent } from "../process/manager.ts";
import type { RpcClient } from "../rpc-client.ts";
import type { RpcSessionStateStore } from "../state-store.ts";
import type { HostToUiMessage } from "../../view/protocol.ts";

interface CreateProcessEventFlowOptions {
  emit(message: HostToUiMessage): void;
  emitState(): void;
  ensureStarted(): Promise<void>;
  extensionUiTimeoutMs: number;
  logger?: Logger;
  reportCommandFailure(response: { success: boolean; error?: string }): void;
  rpcClient: RpcClient;
  stateStore: RpcSessionStateStore;
  syncState(): Promise<void>;
}

export interface ProcessEventFlow {
  dispose(): void;
  handleExtensionUiResponse(requestId: string, payload: unknown): Promise<void>;
  handleProcessEvent(event: ProcessEvent): Promise<void>;
}

export function createProcessEventFlow(options: CreateProcessEventFlowOptions): ProcessEventFlow {
  const extensionUiFlow = createControllerExtensionUiFlow({
    emit: options.emit,
    emitState: options.emitState,
    ensureStarted: options.ensureStarted,
    extensionUiTimeoutMs: options.extensionUiTimeoutMs,
    logger: options.logger,
    reportCommandFailure: options.reportCommandFailure,
    rpcClient: options.rpcClient,
    stateStore: options.stateStore,
    syncState: options.syncState,
  });

  return {
    dispose() {
      extensionUiFlow.dispose();
    },
    async handleExtensionUiResponse(requestId, payload) {
      await extensionUiFlow.handleResponse(requestId, payload);
    },
    async handleProcessEvent(event) {
      if (event.type === "stderr") {
        options.logger?.warn({
          scope: "controller",
          message: "rpc stderr forwarded to ui",
          details: { message: event.message },
        });
        options.emit({ type: "error", scope: "rpc", message: event.message });
        return;
      }
      if (event.type === "process_exit") {
        options.logger?.error({
          scope: "controller",
          message: "rpc process exit observed",
          details: { code: event.code ?? null, signal: event.signal ?? null },
        });
        options.stateStore.markProcessDead(`RPC process exited (${event.code ?? "unknown"})`);
        options.emitState();
        return;
      }
      if (event.type === "extension_ui_request") {
        extensionUiFlow.handleRequest(event);
        return;
      }
      if (event.type === "agent_start" || event.type === "message_update") {
        options.stateStore.markStreaming();
        options.emitState();
        options.emit({ type: "event", data: event });
        return;
      }
      if (event.type === "agent_end") {
        extensionUiFlow.dispose();
        options.stateStore.markIdle();
        options.emitState();
        await options.syncState();
        options.emit({ type: "event", data: event });
        return;
      }
      options.emit({ type: "event", data: event });
    },
  };
}
