import { asRecord, readString, stringifyJson } from "./ui-text.ts";
import {
  readToolArgsFromContent,
  readToolCallIdFromContent,
  readToolNameFromContent,
} from "./activity-event-tool-call.ts";

export function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const textFromMessage = extractMessageText(event.message);
  if (textFromMessage) return textFromMessage;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const textFromPartial = extractMessageText(partial);
  if (textFromPartial) return textFromPartial;
  return readString(event.text);
}

export function extractMessageText(message: unknown): string {
  const record = asRecord(message);
  if (!record) return "";
  const directText = readString(record.text);
  if (directText) return directText;
  const content = record.content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "text") continue;
    const text = readString(entry.text);
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}

export function extractThinkingText(event: Record<string, unknown>): string | undefined {
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const textFromPartial = extractThinkingTextFromMessage(partial);
  if (textFromPartial) return textFromPartial;
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const deltaText = readString(assistantEvent?.delta);
  if (deltaText) return deltaText;
  const endContent = readString(assistantEvent?.content);
  if (endContent) return endContent;
  const textFromMessage = extractThinkingTextFromMessage(event.message);
  if (textFromMessage) return textFromMessage;
  return undefined;
}

export function extractThinkingTextFromMessage(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const content = record.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "thinking") continue;
    const thinking = readString(entry.thinking);
    if (thinking) return thinking;
  }
  return undefined;
}

export function extractToolExecutionText(event: Record<string, unknown>): string | undefined {
  const partialResult = asRecord(event.partialResult);
  const result = asRecord(event.result);
  const partialText = extractMessageText(partialResult);
  if (partialText) return partialText;
  const resultText = extractMessageText(result);
  return resultText || undefined;
}

export function readResponseId(event: Record<string, unknown>): string | undefined {
  const direct = readString(event.responseId);
  if (direct) return direct;
  const message = asRecord(event.message);
  const fromMessage = readString(message?.responseId);
  if (fromMessage) return fromMessage;
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const partial = asRecord(assistantEvent?.partial);
  return readString(partial?.responseId);
}

export function readToolArgsFromEvent(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  return readToolArgsFromContent(message?.content) ?? readToolArgsFromContent(partial?.content);
}

export function readToolArgsFromExecutionEvent(event: Record<string, unknown>): string | undefined {
  if (event.args && typeof event.args === "object") return stringifyJson(event.args);
  return undefined;
}

export function readToolCallIdFromEvent(event: Record<string, unknown>): string | undefined {
  const directFromEvent = readString(event.toolCallId);
  if (directFromEvent) return directFromEvent;
  const message = asRecord(event.message);
  const direct = readString(message?.toolCallId);
  if (direct) return direct;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const fromPartial = readString(partial?.toolCallId);
  if (fromPartial) return fromPartial;
  return readToolCallIdFromContent(message?.content) ?? readToolCallIdFromContent(partial?.content);
}

export function readToolNameFromEvent(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const messageName = readString(message?.toolName);
  if (messageName) return messageName;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const partialName = readString(partial?.toolName);
  if (partialName) return partialName;
  return readToolNameFromContent(message?.content) ?? readToolNameFromContent(partial?.content);
}
