import {
  escapeHtml,
  stripLeadingThinkingBlocks,
  stringifyJson,
  truncateText,
} from "../../../src/view/webview/ui/text.ts";
import { describe, expect, it } from "vitest";

describe("ui text helpers", () => {
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

  it("escapes html and truncates text", () => {
    expect(escapeHtml('<a href="x">Tom & Jerry</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
    expect(truncateText("abcdef", 4)).toBe("abcd...");
    expect(truncateText("abc", 4)).toBe("abc");
  });

  it("stringifies json with fallback to String", () => {
    expect(stringifyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(stringifyJson(cyclic)).toContain("[object Object]");
  });
});
