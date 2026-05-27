import { describe, expect, it } from "vitest";
import { renderInlineMarkdownToHtml } from "../../../src/view/webview/markdown-inline.ts";

describe("renderInlineMarkdownToHtml", () => {
  it("renders strong text, inline code, file reference chips, and line breaks", () => {
    expect(
      renderInlineMarkdownToHtml("请看 **重点**、`code` 和 @src/session/tracker.ts:8\n下一行"),
    ).toContain("<strong>重点</strong>");
    expect(
      renderInlineMarkdownToHtml("请看 **重点**、`code` 和 @src/session/tracker.ts:8\n下一行"),
    ).toContain("<code>code</code>");
    expect(
      renderInlineMarkdownToHtml("请看 **重点**、`code` 和 @src/session/tracker.ts:8\n下一行"),
    ).toContain('class="file-reference-chip"');
    expect(
      renderInlineMarkdownToHtml("请看 **重点**、`code` 和 @src/session/tracker.ts:8\n下一行"),
    ).toContain("tracker.ts:8");
    expect(
      renderInlineMarkdownToHtml("请看 **重点**、`code` 和 @src/session/tracker.ts:8\n下一行"),
    ).toContain("<br>");
  });
});
