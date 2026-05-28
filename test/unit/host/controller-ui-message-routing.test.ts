import { describe, expect, it, vi } from "vitest";

import { createControllerUiMessageRouter } from "../../../src/host/controller/ui-message-router.ts";

describe("controller ui message routing", () => {
  it("routes set_model through runtime command using the current session phase", async () => {
    const runRuntimeCommand = vi.fn(async () => {});
    const router = createControllerUiMessageRouter({
      getCurrentPhase() {
        return "streaming";
      },
      handleCommandUiResponse: vi.fn(async () => {}),
      handleExtensionUiResponse: vi.fn(async () => {}),
      handlePrompt: vi.fn(async () => {}),
      handleRunCommand: vi.fn(async () => {}),
      onRpcQuery: vi.fn(async () => {}),
      onUiReady: vi.fn(async () => {}),
      runRuntimeCommand,
    });

    await router.handle({
      type: "set_model",
      provider: "openai",
      modelId: "gpt-5",
      correlationId: "cid-1",
    });

    expect(runRuntimeCommand).toHaveBeenCalledWith(
      { type: "set_model", provider: "openai", modelId: "gpt-5" },
      "streaming",
      "cid-1",
    );
  });
});
