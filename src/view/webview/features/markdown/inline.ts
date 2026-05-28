import { escapeHtml } from "../../ui/text.ts";

const FILE_REFERENCE_PATTERN = /@((?:[\w.-]+\/)*[\w.-]+\.[\w-]+)(?::(\d+)(?:-(\d+))?)?/g;

export function renderInlineMarkdownToHtml(text: string): string {
  const parts = text.split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      return renderStrongText(renderReferenceAwareText(part));
    })
    .join("")
    .replaceAll("\n", "<br>");
}

export function renderReferenceAwareText(text: string): string {
  let rendered = "";
  let lastIndex = 0;
  for (const match of text.matchAll(FILE_REFERENCE_PATTERN)) {
    const fullMatch = match[0] ?? "";
    const start = match.index ?? 0;
    rendered += escapeHtml(text.slice(lastIndex, start));

    const fullPath = match[1] ?? "";
    const startLine = match[2];
    const endLine = match[3];
    const fileName = fullPath.split("/").at(-1) ?? fullPath;
    const displayName = startLine
      ? endLine
        ? `${fileName}:${startLine}-${endLine}`
        : `${fileName}:${startLine}`
      : fileName;
    const badge = resolveReferenceBadge(fileName);

    rendered += `<button type="button" class="file-reference-chip" data-path="${escapeHtml(fullPath)}" data-start-line="${escapeHtml(startLine ?? "1")}"${endLine ? ` data-end-line="${escapeHtml(endLine)}"` : ""}><span class="file-reference-badge">${escapeHtml(badge)}</span><span class="file-reference-main"><span class="file-reference-name">${escapeHtml(displayName)}</span></span></button>`;
    lastIndex = start + fullMatch.length;
  }
  rendered += escapeHtml(text.slice(lastIndex));
  return rendered;
}

function renderStrongText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function resolveReferenceBadge(fileName: string): string {
  const extension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  if (extension === "ts" || extension === "tsx") return "TS";
  if (extension === "js" || extension === "jsx") return "JS";
  if (extension === "json") return "{}";
  if (extension === "md") return "MD";
  if (extension === "css") return "CSS";
  if (extension === "html") return "HTML";
  if (extension === "yml" || extension === "yaml") return "YML";
  return "FILE";
}
