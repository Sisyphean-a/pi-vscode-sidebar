import { type MarkdownBlock, parseMarkdownBlocks } from "./markdown-blocks.ts";
import { renderInlineMarkdownToHtml, renderReferenceAwareText } from "./markdown-inline.ts";

export function renderAssistantMarkdown(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const blocks = parseMarkdownBlocks(text);
  for (const block of blocks) {
    fragment.append(renderMarkdownBlock(block));
  }
  return fragment;
}

export function renderPlainTextWithReferences(text: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = renderReferenceAwareText(text).replaceAll("\n", "<br>");
  return template.content.cloneNode(true) as DocumentFragment;
}

function createCodeBlock(code: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  const toolbar = document.createElement("div");
  toolbar.className = "code-block-toolbar";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "code-copy-button";
  copyButton.textContent = "复制";
  copyButton.addEventListener("click", () => {
    void navigator.clipboard?.writeText(code);
  });
  toolbar.append(copyButton);

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.textContent = code;
  pre.append(codeElement);
  wrapper.append(toolbar, pre);
  return wrapper;
}

function renderMarkdownBlock(block: MarkdownBlock): HTMLElement {
  if (block.type === "hr") return document.createElement("hr");
  if (block.type === "heading") {
    const heading = document.createElement(`h${block.level}`);
    heading.textContent = block.text;
    return heading;
  }
  if (block.type === "code") {
    return createCodeBlock(block.code);
  }
  if (block.type === "list") {
    const list = document.createElement(block.ordered ? "ol" : "ul");
    for (const item of block.items) {
      const li = document.createElement("li");
      li.innerHTML = renderInlineMarkdownToHtml(item);
      list.append(li);
    }
    return list;
  }
  const paragraph = document.createElement("p");
  paragraph.innerHTML = renderInlineMarkdownToHtml(block.text);
  return paragraph;
}
