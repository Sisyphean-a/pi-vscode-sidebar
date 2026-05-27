import type { RpcClient } from "./rpc-client.ts";
import type { Logger } from "./logger.ts";
import type { RpcSessionStateStore } from "./state-store.ts";
import type { HostToUiMessage } from "../view/protocol.ts";
import type { ProcessEvent } from "./process-manager.ts";
import type { RpcExtensionUIResponse } from "../shared/rpc-types.ts";

interface CreateControllerExtensionUiFlowOptions {
  emit(message: HostToUiMessage): void;
  emitState(): void;
  ensureStarted(): Promise<void>;
  extensionUiTimeoutMs: number;
  logger?: Logger;
  reportCommandFailure(response: { success: boolean; error?: string }): void;
  rpcClient: Pick<RpcClient, "sendExtensionUiResponse">;
  stateStore: Pick<RpcSessionStateStore, "markAwaitingExtensionUi" | "markStreaming">;
  syncState(): Promise<void>;
}

export interface ControllerExtensionUiFlow {
  dispose(): void;
  handleRequest(event: Extract<ProcessEvent, { type: "extension_ui_request" }>): void;
  handleResponse(requestId: string, payload: unknown): Promise<void>;
}

export function createControllerExtensionUiFlow(
  options: CreateControllerExtensionUiFlowOptions,
): ControllerExtensionUiFlow {
  const pendingExtensionUiRequests = new Map<string, NodeJS.Timeout>();

  return {
    dispose() {
      clearAllExtensionUiTimers();
    },
    handleRequest(event) {
      options.logger?.debug({
        scope: "controller",
        correlationId: event.id,
        message: `extension ui request: ${event.method}`,
      });
      if (isBlockingExtensionUiMethod(event.method)) {
        options.stateStore.markAwaitingExtensionUi();
        options.emitState();
        scheduleExtensionUiTimeout(event.id);
      }
      options.emit({ type: "extension_ui_request", data: event });
    },
    async handleResponse(requestId, payload) {
      clearExtensionUiTimer(requestId);
      await options.ensureStarted();
      const responsePayload = normalizeExtensionUiResponse(requestId, payload);
      const response = await options.rpcClient.sendExtensionUiResponse(responsePayload);
      options.reportCommandFailure(response);
      options.stateStore.markStreaming();
      options.emitState();
    },
  };

  function scheduleExtensionUiTimeout(requestId: string): void {
    clearExtensionUiTimer(requestId);
    const timer = setTimeout(() => {
      void onExtensionUiTimeout(requestId);
    }, options.extensionUiTimeoutMs);
    pendingExtensionUiRequests.set(requestId, timer);
  }

  async function onExtensionUiTimeout(requestId: string): Promise<void> {
    pendingExtensionUiRequests.delete(requestId);
    options.emit({
      type: "error",
      scope: "rpc",
      message: `Extension UI request timed out: ${requestId}`,
    });
    const response = await options.rpcClient.sendExtensionUiResponse({
      type: "extension_ui_response",
      id: requestId,
      cancelled: true,
    });
    options.reportCommandFailure(response);
    await options.syncState();
  }

  function clearExtensionUiTimer(requestId: string): void {
    const timer = pendingExtensionUiRequests.get(requestId);
    if (!timer) return;
    clearTimeout(timer);
    pendingExtensionUiRequests.delete(requestId);
  }

  function clearAllExtensionUiTimers(): void {
    for (const timer of pendingExtensionUiRequests.values()) {
      clearTimeout(timer);
    }
    pendingExtensionUiRequests.clear();
  }
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
