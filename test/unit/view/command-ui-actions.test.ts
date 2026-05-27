import { describe, expect, it } from "vitest";

import { resolveCommandUiKeyAction } from "../../../src/view/webview/command-ui-actions.ts";
import {
  createCommandUiState,
  setCommandUiRequest,
} from "../../../src/view/webview/command-ui-state.ts";

describe("command ui actions", () => {
  it("moves selection and requests a rerender for arrow keys", () => {
    const state = createCommandUiState();
    setCommandUiRequest(state, {
      id: "req-1",
      kind: "session_tree",
      items: [
        { id: "node-1", label: "节点 1", active: true },
        { id: "node-2", label: "节点 2" },
      ],
    });

    expect(resolveCommandUiKeyAction(state, "ArrowDown", false)).toEqual({
      type: "rerender",
    });
    expect(state.selectedIndex).toBe(1);
    expect(resolveCommandUiKeyAction(state, "ArrowUp", false)).toEqual({
      type: "rerender",
    });
    expect(state.selectedIndex).toBe(0);
  });

  it("returns submit and cancel actions for enter and escape", () => {
    const state = createCommandUiState();
    setCommandUiRequest(state, {
      id: "req-2",
      kind: "model_list",
      items: [
        {
          id: "openai/gpt-5",
          label: "GPT-5",
          payload: { provider: "openai", modelId: "gpt-5" },
        },
      ],
    });

    expect(resolveCommandUiKeyAction(state, "Enter", false)).toEqual({
      type: "submit",
      requestId: "req-2",
      payload: { provider: "openai", modelId: "gpt-5" },
    });
    expect(resolveCommandUiKeyAction(state, "Escape", false)).toEqual({
      type: "cancel",
      requestId: "req-2",
    });
  });

  it("ignores unrelated keys and shift-enter", () => {
    const state = createCommandUiState();

    expect(resolveCommandUiKeyAction(state, "ArrowDown", false)).toEqual({
      type: "ignore",
    });

    setCommandUiRequest(state, {
      id: "req-3",
      kind: "message_list",
      items: [{ id: "entry-1", label: "Entry 1" }],
    });

    expect(resolveCommandUiKeyAction(state, "Tab", false)).toEqual({
      type: "ignore",
    });
    expect(resolveCommandUiKeyAction(state, "Enter", true)).toEqual({
      type: "ignore",
    });
  });

  it("treats arrow keys as handled when a request has no items", () => {
    const state = createCommandUiState();
    setCommandUiRequest(state, {
      id: "req-4",
      kind: "message_list",
      items: [],
    });

    expect(resolveCommandUiKeyAction(state, "ArrowDown", false)).toEqual({
      type: "handled",
    });
    expect(state.selectedIndex).toBe(0);
  });
});
