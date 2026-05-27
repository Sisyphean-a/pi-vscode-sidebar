import { describe, expect, it } from "vitest";

import { createModelControlState } from "../../../src/view/webview/model-control-state.ts";
import {
  applyAvailableModelsQueryResult,
  applyModelCommandResult,
  applyThinkingLevelCommandResult,
  syncModelControlRpcState,
} from "../../../src/view/webview/model-control-effects.ts";

describe("model control effects", () => {
  it("applies available model catalogs into state", () => {
    const state = createModelControlState();

    applyAvailableModelsQueryResult(state, {
      data: {
        models: [
          { provider: "openai", id: "gpt-5", name: "GPT-5" },
          { provider: "hi-code", id: "gpt-5", name: "GPT-5" },
        ],
      },
    });

    expect(state.modelOptionsLoaded).toBe(true);
    expect(state.availableModelValues).toEqual(["hi-code/gpt-5", "openai/gpt-5"]);
    expect(state.modelLabelByValue.get("openai/gpt-5")).toBe("openai 5");
  });

  it("keeps pending model selection while rpc state is still stale", () => {
    const state = createModelControlState();
    state.pendingModelValue = "openai/gpt-4.1-mini";

    syncModelControlRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
      thinkingLevel: "high",
    });

    expect(state.currentModelValue).toBe("openai/gpt-5");
    expect(state.lastRpcModelValue).toBe("openai/gpt-5");
    expect(state.pendingModelValue).toBe("openai/gpt-4.1-mini");
    expect(state.lastRpcThinkingLevel).toBe("high");
  });

  it("clears pending model selection when rpc state matches the requested model", () => {
    const state = createModelControlState();
    state.pendingModelValue = "openai/gpt-5";

    syncModelControlRpcState(state, {
      model: { provider: "openai", id: "gpt-5" },
    });

    expect(state.pendingModelValue).toBe("");
  });

  it("returns a mismatch note when set_model resolves to a different rpc model", () => {
    const state = createModelControlState();
    state.pendingModelValue = "openai/gpt-4.1-mini";
    state.lastRpcModelValue = "openai/gpt-5";

    expect(applyModelCommandResult(state)).toBe("模型切换未生效，当前仍为 openai/gpt-5");
    expect(state.pendingModelValue).toBe("");
    expect(state.currentModelValue).toBe("openai/gpt-5");
  });

  it("returns a clamp note when set_thinking_level resolves to a different rpc level", () => {
    const state = createModelControlState();
    state.pendingThinkingLevel = "xhigh";
    state.lastRpcThinkingLevel = "high";

    expect(applyThinkingLevelCommandResult(state)).toBe("当前模型暂不支持超高，已保持高");
    expect(state.pendingThinkingLevel).toBe("");
  });
});
