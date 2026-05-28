const ORDERED_LIST_PATTERN = /^(\d+)\.\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^-\s+(.+)$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const FENCE_PATTERN = /^```([\w-]*)\s*$/;

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "hr" }
  | { type: "code"; language: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
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
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        language,
        code: trimTrailingNewline(codeLines.join("\n")),
      });
      continue;
    }
    const listBlock = parseListBlock(lines, index);
    if (listBlock) {
      blocks.push(listBlock.block);
      index = listBlock.nextIndex;
      continue;
    }
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentTrimmed = (lines[index] ?? "").trim();
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

function parseListBlock(
  lines: string[],
  startIndex: number,
): { block: MarkdownBlock; nextIndex: number } | undefined {
  const first = lines[startIndex]?.trim() ?? "";
  const orderedFirst = first.match(ORDERED_LIST_PATTERN);
  const unorderedFirst = first.match(UNORDERED_LIST_PATTERN);
  if (!orderedFirst && !unorderedFirst) return undefined;

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

function trimTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
