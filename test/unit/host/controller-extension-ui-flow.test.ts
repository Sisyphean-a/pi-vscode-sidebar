import { describe, expect, it, vi } from "vitest";

import { createControllerExtensionUiFlow } from "../../../src/host/controller-extension-ui-flow.ts";
import type { RpcResponse } from "../../../src/shared/rpc-types.ts";

describe("controller extension ui flow", () => {
  it("auto-cancels blocking extension ui requests after timeout", async () => {
    vi.useFakeTimers();
    const sendExtensionUiResponse = vi.fn(
      async (): Promise<RpcResponse> => ({
        type: "response",
        command: "extension_ui_response",
        success: true,
      }),
    );
    const flow = createControllerExtensionUiFlow({
      emit: vi.fn(),
      emitState: vi.fn(),
      ensureStarted: vi.fn(async () => {}),
      extensionUiTimeoutMs: 10,
      reportCommandFailure: vi.fn(),
      rpcClient: {
        sendExtensionUiResponse,
      },
      stateStore: {
        markAwaitingExtensionUi: vi.fn(() => ({
          phase: "awaiting_extension_ui" as const,
          updatedAt: 1,
        })),
        markStreaming: vi.fn(() => ({ phase: "streaming" as const, updatedAt: 1 })),
      },
      syncState: vi.fn(async () => {}),
    });

    flow.handleRequest({
      type: "extension_ui_request",
      id: "req-timeout",
      method: "input",
      title: "Need input",
    });
    await vi.advanceTimersByTimeAsync(1200);

    expect(sendExtensionUiResponse).toHaveBeenCalledWith({
      type: "extension_ui_response",
      id: "req-timeout",
      cancelled: true,
    });

    vi.useRealTimers();
  });
});
