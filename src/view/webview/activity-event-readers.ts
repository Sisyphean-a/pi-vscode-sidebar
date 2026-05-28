import { z } from "zod";
import {
  readAssistantEventPartial,
  readMessageContentEntries,
  readRecord,
  readString,
} from "./activity-event-zod.ts";
import { stringifyJson } from "./ui-text.ts";
import {
  readToolArgsFromContent,
  readToolCallIdFromContent,
  readToolNameFromContent,
} from "./activity-event-tool-call.ts";

const TextContentEntrySchema = z
  .object({
    type: z.literal("text"),
    text: z.string().optional(),
  })
  .catchall(z.unknown());

const ThinkingContentEntrySchema = z
  .object({
    type: z.literal("thinking"),
    thinking: z.string().optional(),
  })
  .catchall(z.unknown());

export function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const textFromMessage = extractMessageText(event.message);
  if (textFromMessage) return textFromMessage;
  const partial = readAssistantEventPartial(event);
  const textFromPartial = extractMessageText(partial);
  if (textFromPartial) return textFromPartial;
  return readString(event.text);
}

export function extractMessageText(message: unknown): string {
  const record = readRecord(message);
  if (!record) return "";
  const directText = readString(record.text);
  if (directText) return directText;
  const contentEntries = readMessageContentEntries(record);
  if (!contentEntries) return "";
  const parts: string[] = [];
  for (const entry of contentEntries) {
    const parsedEntry = TextContentEntrySchema.safeParse(entry);
    if (!parsedEntry.success || !parsedEntry.data.text) continue;
    parts.push(parsedEntry.data.text);
  }
  return parts.join("\n\n");
}

export function extractThinkingText(event: Record<string, unknown>): string | undefined {
  const partial = readAssistantEventPartial(event);
  const textFromPartial = extractThinkingTextFromMessage(partial);
  if (textFromPartial) return textFromPartial;
  const assistantEvent = readRecord(event.assistantMessageEvent);
  const deltaText = readString(assistantEvent?.delta);
  if (deltaText) return deltaText;
  const endContent = readString(assistantEvent?.content);
  if (endContent) return endContent;
  const textFromMessage = extractThinkingTextFromMessage(event.message);
  if (textFromMessage) return textFromMessage;
  return undefined;
}

export function extractThinkingTextFromMessage(message: unknown): string | undefined {
  const contentEntries = readMessageContentEntries(message);
  if (!contentEntries) return undefined;
  for (const entry of contentEntries) {
    const parsedEntry = ThinkingContentEntrySchema.safeParse(entry);
    if (!parsedEntry.success || !parsedEntry.data.thinking) continue;
    return parsedEntry.data.thinking;
  }
  return undefined;
}

export function extractToolExecutionText(event: Record<string, unknown>): string | undefined {
  const partialResult = readRecord(event.partialResult);
  const result = readRecord(event.result);
  const partialText = extractMessageText(partialResult);
  if (partialText) return partialText;
  const resultText = extractMessageText(result);
  return resultText || undefined;
}

export function readResponseId(event: Record<string, unknown>): string | undefined {
  const direct = readString(event.responseId);
  if (direct) return direct;
  const message = readRecord(event.message);
  const fromMessage = readString(message?.responseId);
  if (fromMessage) return fromMessage;
  const partial = readAssistantEventPartial(event);
  return readString(partial?.responseId);
}

export function readToolArgsFromEvent(event: Record<string, unknown>): string | undefined {
  const message = readRecord(event.message);
  const partial = readAssistantEventPartial(event);
  return readToolArgsFromContent(message?.content) ?? readToolArgsFromContent(partial?.content);
}

export function readToolArgsFromExecutionEvent(event: Record<string, unknown>): string | undefined {
  const argsObject = readRecord(event.args);
  if (argsObject) return stringifyJson(argsObject);
  return undefined;
}

export function readToolCallIdFromEvent(event: Record<string, unknown>): string | undefined {
  const directFromEvent = readString(event.toolCallId);
  if (directFromEvent) return directFromEvent;
  const message = readRecord(event.message);
  const direct = readString(message?.toolCallId);
  if (direct) return direct;
  const partial = readAssistantEventPartial(event);
  const fromPartial = readString(partial?.toolCallId);
  if (fromPartial) return fromPartial;
  return readToolCallIdFromContent(message?.content) ?? readToolCallIdFromContent(partial?.content);
}

export function readToolNameFromEvent(event: Record<string, unknown>): string | undefined {
  const message = readRecord(event.message);
  const messageName = readString(message?.toolName);
  if (messageName) return messageName;
  const partial = readAssistantEventPartial(event);
  const partialName = readString(partial?.toolName);
  if (partialName) return partialName;
  return readToolNameFromContent(message?.content) ?? readToolNameFromContent(partial?.content);
}
