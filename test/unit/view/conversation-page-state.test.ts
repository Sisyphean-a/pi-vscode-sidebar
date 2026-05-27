import { describe, expect, it } from "vitest";
import {
  applyReplayResult,
  applyViewState,
  createConversationPageState,
  nextLocalMessageKey,
  shouldScrollToBottom,
  shouldShowScrollToBottomButton,
  syncConversationContent,
  syncNearBottom,
} from "../../../src/view/webview/conversation-page-state.ts";

describe("conversation page state", () => {
  it("shows recent sessions only after replay resolves and hides them once content appears", () => {
    const state = createConversationPageState();

    expect(syncConversationContent(state, false)).toBe(false);
    expect(
      applyReplayResult(state, {
        hasMessages: false,
        replace: true,
      }),
    ).toEqual({ shouldReset: true });
    expect(syncConversationContent(state, false)).toBe(true);
    expect(nextLocalMessageKey(state, "user")).toBe("user:local:1");
    expect(syncConversationContent(state, true)).toBe(false);
  });

  it("shows scroll-to-bottom only while streaming and auto scroll is disabled", () => {
    const state = createConversationPageState();

    applyViewState(state, { phase: "streaming", sessionPath: "C:\\sessions\\a.jsonl" });
    expect(shouldShowScrollToBottomButton(state)).toBe(false);
    expect(shouldScrollToBottom(state, false)).toBe(true);

    syncNearBottom(state, false);
    expect(shouldShowScrollToBottomButton(state)).toBe(true);
    expect(shouldScrollToBottom(state, false)).toBe(false);
    expect(shouldScrollToBottom(state, true)).toBe(true);
  });
});
