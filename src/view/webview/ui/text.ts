export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function stripLeadingThinkingBlocks(text: string): string {
  let remaining = text;
  let changed = false;

  while (true) {
    const startMatch = remaining.match(/^\s*<(thinking|think)>\s*/i);
    if (!startMatch) return changed ? remaining : text;

    const tagName = startMatch[1]?.toLowerCase();
    if (!tagName) return changed ? remaining : text;

    const closingTag = `</${tagName}>`;
    const closeIndex = remaining.toLowerCase().indexOf(closingTag, startMatch[0].length);
    if (closeIndex < 0) return "";

    remaining = remaining.slice(closeIndex + closingTag.length).trimStart();
    changed = true;
  }
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
