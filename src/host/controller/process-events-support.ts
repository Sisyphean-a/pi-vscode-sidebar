import type { ProcessEvent } from "../process/manager.ts";

export function isAssistantMessageStartProcessEvent(event: ProcessEvent): boolean {
  if (event.type !== "message_start") return false;
  const message = readRecord(event.message);
  return readString(message?.role) === "assistant";
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
