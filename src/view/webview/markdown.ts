import { escapeHtml } from "./ui-text.ts";

const FENCED_CODE_BLOCK = /^```([\w-]*)\n([\s\S]*?)```$/;

export function renderAssistantMarkdown(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const blocks = splitBlocks(text);

  for (const block of blocks) {
    if (block.type === "heading") {
      const heading = document.createElement("h1");
      heading.textContent = block.text;
      fragment.append(heading);
      continue;
    }

    if (block.type === "code") {
      fragment.append(createCodeBlock(block.language, block.code));
      continue;
    }

    if (block.type === "paragraph") {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = renderInlineMarkdown(block.text);
      fragment.append(paragraph);
    }
  }

  return fragment;
}

type MarkdownBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string };

function splitBlocks(text: string): MarkdownBlock[] {
  const normalized = text.replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks = normalized.split(/\n{2,}/);
  const blocks: MarkdownBlock[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading", text: trimmed.slice(2).trim() });
      continue;
    }

    const codeMatch = trimmed.match(FENCED_CODE_BLOCK);
    if (codeMatch) {
      blocks.push({
        type: "code",
        language: codeMatch[1] ?? "",
        code: trimTrailingNewline(codeMatch[2] ?? ""),
      });
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
  }
  return blocks;
}

function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replaceAll(/`([^`]+)`/g, "<code>$1</code>").replaceAll("\n", "<br>");
}

function createCodeBlock(language: string, code: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  const toolbar = document.createElement("div");
  toolbar.className = "code-block-toolbar";

  const label = document.createElement("span");
  label.className = "code-block-language";
  label.textContent = language || "text";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "code-copy-button";
  copyButton.textContent = "复制";
  copyButton.addEventListener("click", () => {
    void navigator.clipboard?.writeText(code);
  });

  toolbar.append(label, copyButton);

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.textContent = code;
  pre.append(codeElement);

  wrapper.append(toolbar, pre);
  return wrapper;
}

function trimTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
