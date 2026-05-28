import { describe, expect, it } from "vitest";

import {
  createModelControlState,
  requestModelChange,
  requestThinkingLevelChange,
} from "../../../src/view/webview/features/model/control-state.ts";
import { getRenderState } from "../../../src/view/webview/features/model/control-render.ts";
import { handleQueryResult, syncRpcState } from "../../../src/view/webview/features/model/control-state.ts";

describe("model control render", () => {
  it("prefers pending model capabilities until a model change command resolves", () => {
    const state = createModelControlState();

    expect(
      handleQueryResult(state, {
        command: "get_available_models",
        data: {
          models: [
            {
              provider: "openai",
              id: "gpt-5",
              reasoning: true,
              input: ["text", "image"],
            },
            {
              provider: "openai",
              id: "gpt-4.1-mini",
              input: ["text"],
            },
          ],
        },
      }),
    ).toEqual({ consumed: true });

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });

    requestModelChange(state, "openai/gpt-4.1-mini");
    expect(getRenderState(state).supportsImageInput).toBe(false);
    expect(getRenderState(state).supportedThinkingLevels).toEqual(["off"]);

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });
    handleQueryResult(state, { command: "set_model" });

    expect(getRenderState(state).supportsImageInput).toBe(true);
    expect(getRenderState(state).supportedThinkingLevels).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
  });

  it("falls back to the resolved thinking level when a requested level is rejected", () => {
    const state = createModelControlState();

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });
    requestThinkingLevelChange(state, "xhigh");

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });
    handleQueryResult(state, { command: "set_thinking_level" });

    expect(getRenderState(state).preferredThinkingLevel).toBe("high");
  });
});
