import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "../../../src/view/webview/features/markdown/blocks.ts";

describe("parseMarkdownBlocks", () => {
  it("parses headings, paragraphs, hr, code fences, and lists in current sidebar markdown dialect", () => {
    expect(
      parseMarkdownBlocks(`# 标题

第一行
第二行

---

\`\`\`ts
const answer = 42;
\`\`\`

1. 第一项
- 第二项
`),
    ).toEqual([
      { type: "heading", level: 1, text: "标题" },
      { type: "paragraph", text: "第一行\n第二行" },
      { type: "hr" },
      { type: "code", language: "ts", code: "const answer = 42;" },
      { type: "list", ordered: true, items: ["第一项", "第二项"] },
    ]);
  });
});
