import { describe, expect, it } from "vitest";
import {
  createCommandUiFlowState,
  rememberPendingCommandUiRequest,
  takePendingCommandUiRequest,
} from "../../../src/host/controller-command-ui-flow-state.ts";

describe("controller command ui flow state", () => {
  it("stores and removes pending requests by request id", () => {
    const state = createCommandUiFlowState();

    rememberPendingCommandUiRequest(state, "req-model-1", {
      kind: "model",
      rawInput: "/model",
    });

    expect(takePendingCommandUiRequest(state, "req-model-1")).toEqual({
      kind: "model",
      rawInput: "/model",
    });
    expect(takePendingCommandUiRequest(state, "req-model-1")).toBeUndefined();
  });
});
