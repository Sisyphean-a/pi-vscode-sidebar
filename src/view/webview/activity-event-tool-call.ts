import { z } from "zod";
import { readRecord, readRecordArray, readString } from "./activity-event-zod.ts";
import { stringifyJson } from "./ui-text.ts";

const ToolCallEntrySchema = z
  .object({
    type: z.literal("toolCall"),
    id: z.string().optional(),
    name: z.string().optional(),
    args: z.unknown().optional(),
    partialArgs: z.string().optional(),
  })
  .catchall(z.unknown());

export function readToolArgsFromContent(content: unknown): string | undefined {
  const toolCall = findToolCallContentEntry(content);
  if (!toolCall) return undefined;
  const args = readString(toolCall.args) ?? toolCall.partialArgs;
  if (args) return args;
  const argsObject = readRecord(toolCall.args);
  if (argsObject) return stringifyJson(argsObject);
  return undefined;
}

export function readToolCallIdFromContent(content: unknown): string | undefined {
  return readToolCallText(content, "id");
}

export function readToolNameFromContent(content: unknown): string | undefined {
  return readToolCallText(content, "name");
}

function findToolCallContentEntry(
  content: unknown,
): z.infer<typeof ToolCallEntrySchema> | undefined {
  const entries = readRecordArray(content);
  if (!entries) return undefined;
  for (const entry of entries) {
    const parsed = ToolCallEntrySchema.safeParse(entry);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

function readToolCallText(content: unknown, key: "id" | "name"): string | undefined {
  const toolCall = findToolCallContentEntry(content);
  if (!toolCall) return undefined;
  return toolCall[key];
}
