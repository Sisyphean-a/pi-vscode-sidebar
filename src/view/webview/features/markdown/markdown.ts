import { h, type ComponentChildren } from "preact";
import { type MarkdownBlock, parseMarkdownBlocks } from "./blocks.ts";
import { renderInlineMarkdownToHtml, renderReferenceAwareText } from "./inline.ts";

export function renderAssistantMarkdown(text: string): ComponentChildren {
  return parseMarkdownBlocks(text).map((block, index) =>
    h(MarkdownBlockNode, { block, key: `markdown-block:${index}` }),
  );
}

export function renderPlainTextWithReferences(text: string): ComponentChildren {
  return h("span", {
    dangerouslySetInnerHTML: {
      __html: renderReferenceAwareText(text).replaceAll("\n", "<br>"),
    },
  });
}

function createCodeBlock(code: string): ComponentChildren {
  return h(
    "div",
    { class: "code-block" },
    h(
      "div",
      { class: "code-block-toolbar" },
      h(
        "button",
        {
          type: "button",
          class: "code-copy-button",
          onClick() {
            void navigator.clipboard?.writeText(code);
          },
        },
        "复制",
      ),
    ),
    h("pre", null, h("code", null, code)),
  );
}

function MarkdownBlockNode(props: { block: MarkdownBlock }): ComponentChildren {
  const block = props.block;
  if (block.type === "hr") return h("hr", null);
  if (block.type === "heading") {
    const tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return h(tag, null, block.text);
  }
  if (block.type === "code") {
    return createCodeBlock(block.code);
  }
  if (block.type === "list") {
    const listTag = block.ordered ? "ol" : "ul";
    return h(
      listTag,
      null,
      block.items.map((item, itemIndex) =>
        h("li", {
          key: `markdown-list-item:${itemIndex}`,
          dangerouslySetInnerHTML: { __html: renderInlineMarkdownToHtml(item) },
        }),
      ),
    );
  }
  return h("p", {
    dangerouslySetInnerHTML: { __html: renderInlineMarkdownToHtml(block.text) },
  });
}
