import { asRecord, readString, stringifyJson } from "./ui-text.ts";

export function readToolArgsFromContent(content: unknown): string | undefined {
  const toolCall = findToolCallContentEntry(content);
  if (!toolCall) return undefined;
  const args = readString(toolCall.args) ?? readString(toolCall.partialArgs);
  if (args) return args;
  if (toolCall.args && typeof toolCall.args === "object") return stringifyJson(toolCall.args);
  return undefined;
}

export function readToolCallIdFromContent(content: unknown): string | undefined {
  return readToolCallText(content, "id");
}

export function readToolNameFromContent(content: unknown): string | undefined {
  return readToolCallText(content, "name");
}

function findToolCallContentEntry(content: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (entry && readString(entry.type) === "toolCall") return entry;
  }
  return undefined;
}

function readToolCallText(content: unknown, key: "id" | "name"): string | undefined {
  const toolCall = findToolCallContentEntry(content);
  return readString(toolCall?.[key]);
}
