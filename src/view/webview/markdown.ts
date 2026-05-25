import { escapeHtml } from "./ui-text.ts";

const FILE_REFERENCE_PATTERN = /^@([^:\s]+):(\d+)(?:-(\d+))?$/;
const ORDERED_LIST_PATTERN = /^(\d+)\.\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^-\s+(.+)$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const FENCE_PATTERN = /^```([\w-]*)\s*$/;

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "hr" }
  | { type: "code"; language: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function renderAssistantMarkdown(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const blocks = parseBlocks(text);

  for (const block of blocks) {
    if (block.type === "hr") {
      fragment.append(document.createElement("hr"));
      continue;
    }

    if (block.type === "heading") {
      const heading = document.createElement(`h${block.level}`);
      heading.textContent = block.text;
      fragment.append(heading);
      continue;
    }

    if (block.type === "code") {
      fragment.append(createCodeBlock(block.language, block.code));
      continue;
    }

    if (block.type === "list") {
      const list = document.createElement(block.ordered ? "ol" : "ul");
      for (const item of block.items) {
        const li = document.createElement("li");
        li.innerHTML = renderInlineMarkdown(item);
        list.append(li);
      }
      fragment.append(list);
      continue;
    }

    const paragraph = document.createElement("p");
    paragraph.innerHTML = renderInlineMarkdown(block.text);
    fragment.append(paragraph);
  }

  return fragment;
}

function parseBlocks(text: string): MarkdownBlock[] {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_PATTERN);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]?.length ?? 1,
        text: headingMatch[2]?.trim() ?? "",
      });
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(FENCE_PATTERN);
    if (fenceMatch) {
      const codeLines: string[] = [];
      const language = fenceMatch[1] ?? "";
      index += 1;
      while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language,
        code: trimTrailingNewline(codeLines.join("\n")),
      });
      continue;
    }

    const listBlock = parseList(lines, index);
    if (listBlock) {
      blocks.push(listBlock.block);
      index = listBlock.nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed === "---" ||
        HEADING_PATTERN.test(currentTrimmed) ||
        FENCE_PATTERN.test(currentTrimmed) ||
        ORDERED_LIST_PATTERN.test(currentTrimmed) ||
        UNORDERED_LIST_PATTERN.test(currentTrimmed)
      ) {
        break;
      }
      paragraphLines.push(currentTrimmed);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks;
}

function parseList(
  lines: string[],
  startIndex: number,
): { block: MarkdownBlock; nextIndex: number } | undefined {
  const first = lines[startIndex]?.trim() ?? "";
  const orderedFirst = first.match(ORDERED_LIST_PATTERN);
  const unorderedFirst = first.match(UNORDERED_LIST_PATTERN);
  if (!orderedFirst && !unorderedFirst) {
    return undefined;
  }

  const ordered = Boolean(orderedFirst);
  const items: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    const orderedMatch = trimmed.match(ORDERED_LIST_PATTERN);
    const unorderedMatch = trimmed.match(UNORDERED_LIST_PATTERN);
    if (ordered) {
      if (orderedMatch) {
        items.push(orderedMatch[2] ?? "");
        index += 1;
        continue;
      }
      if (unorderedMatch) {
        items.push(unorderedMatch[1] ?? "");
        index += 1;
        continue;
      }
      break;
    }

    if (unorderedMatch) {
      items.push(unorderedMatch[1] ?? "");
      index += 1;
      continue;
    }
    break;
  }

  return {
    block: { type: "list", ordered, items },
    nextIndex: index,
  };
}

function renderInlineMarkdown(text: string): string {
  const parts = text.split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      return renderReferenceAwareText(part);
    })
    .join("")
    .replaceAll("\n", "<br>");
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

function renderReferenceAwareText(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => {
      const match = token.match(FILE_REFERENCE_PATTERN);
      if (!match) {
        return escapeHtml(token);
      }

      const fullPath = match[1] ?? "";
      const startLine = match[2] ?? "";
      const endLine = match[3];
      const fileName = fullPath.split("/").at(-1) ?? fullPath;
      const displayPath = endLine
        ? `${fullPath}:${startLine}-${endLine}`
        : `${fullPath}:${startLine}`;

      return `<button type="button" class="file-reference-chip" data-path="${escapeHtml(fullPath)}" data-start-line="${escapeHtml(startLine)}"${endLine ? ` data-end-line="${escapeHtml(endLine)}"` : ""}><span class="file-reference-name">${escapeHtml(fileName)}</span><span class="file-reference-path">${escapeHtml(displayPath)}</span></button>`;
    })
    .join("");
}

function trimTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
