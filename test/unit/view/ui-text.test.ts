import { describe, expect, it } from "vitest";
import { stripLeadingThinkingBlocks } from "../../../src/view/webview/ui-text.ts";

describe("stripLeadingThinkingBlocks", () => {
  it("removes leading thinking-wrapped text and keeps the visible answer", () => {
    expect(
      stripLeadingThinkingBlocks(
        "<thinking>Need inspect useApplyForm and EMAIL_SUFFIX_OPTIONS.</thinking>最终答案在常量里。",
      ),
    ).toBe("最终答案在常量里。");
  });

  it("keeps html-like thinking tags when they appear as ordinary body text", () => {
    expect(
      stripLeadingThinkingBlocks("这是示例：<thinking>hidden content</thinking> 也要正常显示。"),
    ).toBe("这是示例：<thinking>hidden content</thinking> 也要正常显示。");
  });

  it("hides an unterminated leading thinking block while streaming", () => {
    expect(stripLeadingThinkingBlocks("<thinking>still thinking")).toBe("");
  });
});
