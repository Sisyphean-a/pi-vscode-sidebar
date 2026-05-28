import { z } from "zod";

const RecordSchema = z.object({}).catchall(z.unknown());
const RecordArraySchema = z.array(RecordSchema);
const StringSchema = z.string();
const ToolExecutionEventTypeSchema = z.enum([
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
]);
const RoleSchema = z.enum(["user", "assistant", "toolResult"]);

export type ToolExecutionEventType = z.infer<typeof ToolExecutionEventTypeSchema>;
export type ActivityMessageRole = z.infer<typeof RoleSchema>;

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  const parsed = RecordSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readRecordArray(value: unknown): Record<string, unknown>[] | undefined {
  const parsed = RecordArraySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readString(value: unknown): string | undefined {
  const parsed = StringSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readToolExecutionEventType(value: unknown): ToolExecutionEventType | undefined {
  const parsed = ToolExecutionEventTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readActivityMessageRole(value: unknown): ActivityMessageRole | undefined {
  const parsed = RoleSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function readAssistantEventPartial(
  event: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const assistantEvent = readRecord(event.assistantMessageEvent);
  if (!assistantEvent) return undefined;
  return readRecord(assistantEvent.partial);
}

export function readMessageContentEntries(message: unknown): Record<string, unknown>[] | undefined {
  const record = readRecord(message);
  if (!record) return undefined;
  return readRecordArray(record.content);
}
