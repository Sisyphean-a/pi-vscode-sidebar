import { describe, expect, it } from "vitest";
import {
  applyMessageText,
  createConversationFeedState,
  shouldCollapseToolText,
  summarizeToolText,
} from "../../../src/view/webview/conversation-feed-state.ts";

describe("conversation feed state", () => {
  it("promotes fallback keys and strips leading thinking blocks for assistant text", () => {
    const state = createConversationFeedState();

    expect(
      applyMessageText(state, {
        key: "assistant:active",
        role: "assistant",
        nextText: "<thinking>先分析</thinking>最终答案",
        mode: "replace",
      }),
    ).toEqual({
      changed: true,
      key: "assistant:active",
      promotedFromKey: undefined,
      role: "assistant",
      text: "最终答案",
    });

    expect(
      applyMessageText(state, {
        key: "assistant:resp-1",
        role: "assistant",
        nextText: "最终答案\n补充说明",
        mode: "merge",
        fallbackKeys: ["assistant:active"],
      }),
    ).toEqual({
      changed: true,
      key: "assistant:resp-1",
      promotedFromKey: "assistant:active",
      role: "assistant",
      text: "最终答案\n补充说明",
    });
  });

  it("collapses long or multiline tool text and keeps a short first-line summary", () => {
    const longText = "line-1\nline-2\nline-3\nline-4\nline-5";
    expect(shouldCollapseToolText(longText)).toBe(true);
    expect(summarizeToolText(longText)).toBe("line-1");

    const wideText = `${"x".repeat(90)}\nextra`;
    expect(shouldCollapseToolText(wideText)).toBe(false);
    expect(summarizeToolText(wideText)).toBe(`${"x".repeat(80)}...`);
  });
});
