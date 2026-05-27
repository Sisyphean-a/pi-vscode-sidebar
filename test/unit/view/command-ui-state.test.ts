import { describe, expect, it } from "vitest";

import {
  clearCommandUiState,
  createCommandUiState,
  moveCommandUiSelection,
  readCommandUiSelectionPayload,
  setCommandUiRequest,
} from "../../../src/view/webview/command-ui-state.ts";

describe("command ui state", () => {
  it("selects the active item when a request is shown and falls back to index 0", () => {
    const state = createCommandUiState();

    setCommandUiRequest(state, {
      id: "req-1",
      kind: "message_list",
      items: [
        { id: "entry-1", label: "Entry 1" },
        { id: "entry-2", label: "Entry 2", active: true },
      ],
    });
    expect(state.selectedIndex).toBe(1);

    setCommandUiRequest(state, {
      id: "req-2",
      kind: "message_list",
      items: [
        { id: "entry-3", label: "Entry 3" },
        { id: "entry-4", label: "Entry 4" },
      ],
    });
    expect(state.selectedIndex).toBe(0);
  });

  it("wraps selection movement across request items", () => {
    const state = createCommandUiState();
    setCommandUiRequest(state, {
      id: "req-3",
      kind: "session_tree",
      items: [
        { id: "node-1", label: "Node 1" },
        { id: "node-2", label: "Node 2" },
        { id: "node-3", label: "Node 3" },
      ],
    });

    expect(moveCommandUiSelection(state, 1)).toBe(true);
    expect(state.selectedIndex).toBe(1);
    expect(moveCommandUiSelection(state, 1)).toBe(true);
    expect(state.selectedIndex).toBe(2);
    expect(moveCommandUiSelection(state, 1)).toBe(true);
    expect(state.selectedIndex).toBe(0);
    expect(moveCommandUiSelection(state, -1)).toBe(true);
    expect(state.selectedIndex).toBe(2);
  });

  it("resolves the selected payload and clears state", () => {
    const state = createCommandUiState();
    setCommandUiRequest(state, {
      id: "req-4",
      kind: "model_list",
      items: [
        {
          id: "openai/gpt-5",
          label: "GPT-5",
          payload: { provider: "openai", modelId: "gpt-5" },
        },
      ],
    });

    expect(readCommandUiSelectionPayload(state)).toEqual({
      requestId: "req-4",
      payload: { provider: "openai", modelId: "gpt-5" },
    });

    clearCommandUiState(state);
    expect(state.currentRequest).toBeUndefined();
    expect(state.selectedIndex).toBe(0);
    expect(readCommandUiSelectionPayload(state)).toBeUndefined();
  });
});
