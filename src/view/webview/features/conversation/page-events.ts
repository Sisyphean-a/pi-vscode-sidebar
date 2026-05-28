import { z } from "zod";
import type { RpcSlashCommand } from "../../../../shared/rpc-types.ts";

type ToolExecutionEventType =
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end";

export type ConversationPageEvent =
  | { kind: "activityMessageEnd"; event: Record<string, unknown> }
  | { kind: "activityMessageUpdate"; event: Record<string, unknown> }
  | { kind: "availableCommandsQueryResult"; commands: RpcSlashCommand[] }
  | { kind: "handledNoop" }
  | { kind: "messageReplayQueryResult"; messages: unknown[] | undefined; replace: boolean }
  | {
      kind: "toolExecutionEvent";
      event: Record<string, unknown>;
      eventType: ToolExecutionEventType;
    };

const TOOL_EXECUTION_EVENT_TYPES = [
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
] as const;
const HANDLED_NOOP_EVENT_TYPES = new Set(["rpc_command_sent", "rpc_response", "message_start"]);
const RecordSchema = z.object({}).catchall(z.unknown());
const EventSchema = RecordSchema.extend({ type: z.string() });
const QueryResultEventSchema = EventSchema.extend({
  type: z.literal("query_result"),
  command: z.string(),
});
const ToolExecutionEventTypeSchema = z.enum(TOOL_EXECUTION_EVENT_TYPES);
const RpcSourceInfoSchema = z.object({
  path: z.string(),
  source: z.string(),
  scope: z.enum(["user", "project", "temporary"]),
  origin: z.string(),
  baseDir: z.string().optional(),
});
const RpcSlashCommandSchema: z.ZodType<RpcSlashCommand> = z.object({
  name: z.string(),
  description: z.string().optional(),
  source: z.enum(["extension", "prompt", "skill"]),
  sourceInfo: RpcSourceInfoSchema,
});
const CommandListSchema = z
  .object({ commands: z.array(z.unknown()) })
  .catchall(z.unknown())
  .transform(({ commands }) => ({
    commands: commands
      .map((entry) => RpcSlashCommandSchema.safeParse(entry))
      .filter((entry): entry is { success: true; data: RpcSlashCommand } => entry.success)
      .map((entry) => entry.data),
  }));
const DirectMessageArraySchema = z.array(z.unknown());
const MessageListPayloadSchema = z.object({ messages: z.array(z.unknown()) }).catchall(z.unknown());
const NestedMessageListPayloadSchema = z
  .object({
    data: MessageListPayloadSchema,
  })
  .catchall(z.unknown());
const MessagePayloadSchema = z.union([
  DirectMessageArraySchema,
  MessageListPayloadSchema,
  NestedMessageListPayloadSchema,
]);
const GetCommandsQueryResultSchema = QueryResultEventSchema.extend({
  command: z.literal("get_commands"),
  data: CommandListSchema,
});
const GetMessagesQueryResultSchema = QueryResultEventSchema.extend({
  command: z.literal("get_messages"),
  replace: z.boolean(),
  data: MessagePayloadSchema,
});
const QueryResultVariantSchema = z.union([
  GetCommandsQueryResultSchema,
  GetMessagesQueryResultSchema,
]);

export function resolveConversationPageEvent(data: unknown): ConversationPageEvent | undefined {
  const parsed = EventSchema.safeParse(data);
  if (!parsed.success) return undefined;

  const event = parsed.data;
  if (event.type === "query_result") {
    const queryResult = QueryResultEventSchema.safeParse(event);
    if (!queryResult.success) return undefined;
    return resolveQueryResultEvent(queryResult.data);
  }
  if (HANDLED_NOOP_EVENT_TYPES.has(event.type)) {
    return { kind: "handledNoop" };
  }
  if (event.type === "message_update") {
    return { kind: "activityMessageUpdate", event };
  }
  if (event.type === "message_end") {
    return { kind: "activityMessageEnd", event };
  }
  if (isToolExecutionEvent(event.type)) {
    return { kind: "toolExecutionEvent", event, eventType: event.type };
  }
  return undefined;
}

function extractMessageArray(payload: z.infer<typeof MessagePayloadSchema>): unknown[] {
  const directPayload = DirectMessageArraySchema.safeParse(payload);
  if (directPayload.success) return directPayload.data;
  const messageListPayload = MessageListPayloadSchema.safeParse(payload);
  if (messageListPayload.success) return messageListPayload.data.messages;
  return NestedMessageListPayloadSchema.parse(payload).data.messages;
}

function isToolExecutionEvent(type: string): type is ToolExecutionEventType {
  return ToolExecutionEventTypeSchema.safeParse(type).success;
}

function resolveQueryResultEvent(
  event: z.infer<typeof QueryResultEventSchema>,
): ConversationPageEvent | undefined {
  const parsed = QueryResultVariantSchema.safeParse(event);
  if (!parsed.success) return undefined;
  if (parsed.data.command === "get_commands") {
    return { kind: "availableCommandsQueryResult", commands: parsed.data.data.commands };
  }
  return {
    kind: "messageReplayQueryResult",
    messages: extractMessageArray(parsed.data.data),
    replace: parsed.data.replace,
  };
}
