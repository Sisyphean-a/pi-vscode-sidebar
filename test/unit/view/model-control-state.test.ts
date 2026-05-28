import { describe, expect, it } from "vitest";
import {
  createModelControlState,
  handleQueryResult,
  requestThinkingLevelChange,
  requestModelChange,
  syncRpcState,
} from "../../../src/view/webview/features/model/control-state.ts";

describe("model control state", () => {
  it("builds disambiguated model labels from available model query results", () => {
    const state = createModelControlState();

    expect(
      handleQueryResult(state, {
        command: "get_available_models",
        data: {
          data: {
            models: [
              { provider: "openai", id: "gpt-5", name: "GPT-5" },
              { provider: "hi-code", id: "gpt-5", name: "GPT-5" },
              { provider: "anthropic", id: "claude-opus-4", name: "Claude-Opus-4" },
            ],
          },
        },
      }),
    ).toEqual({ consumed: true });

    expect(state.modelOptionsLoaded).toBe(true);
    expect(state.availableModelValues).toEqual([
      "anthropic/claude-opus-4",
      "hi-code/gpt-5",
      "openai/gpt-5",
    ]);
    expect(state.modelLabelByValue.get("openai/gpt-5")).toBe("openai 5");
    expect(state.modelLabelByValue.get("hi-code/gpt-5")).toBe("hi-code 5");
    expect(state.modelLabelByValue.get("anthropic/claude-opus-4")).toBe("Opus 4");
  });

  it("stores pending model selection until set_model resolves against rpc state", () => {
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

    expect(requestModelChange(state, "openai/gpt-4.1-mini")).toEqual({
      provider: "openai",
      modelId: "gpt-4.1-mini",
      note: "已请求切换模型到 openai/gpt-4.1-mini",
    });
    expect(state.pendingModelValue).toBe("openai/gpt-4.1-mini");

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });

    expect(state.pendingModelValue).toBe("openai/gpt-4.1-mini");
    expect(handleQueryResult(state, { command: "set_model" })).toEqual({
      consumed: true,
      note: "模型切换未生效，当前仍为 openai/gpt-5",
    });
    expect(state.pendingModelValue).toBe("");
  });

  it("reports when the backend keeps a different thinking level than the requested one", () => {
    const state = createModelControlState();

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });

    expect(requestThinkingLevelChange(state, "xhigh")).toBe("xhigh");

    syncRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });

    expect(handleQueryResult(state, { command: "set_thinking_level" })).toEqual({
      consumed: true,
      note: "当前模型暂不支持超高，已保持高",
    });
    expect(state.pendingThinkingLevel).toBe("");
  });
});
