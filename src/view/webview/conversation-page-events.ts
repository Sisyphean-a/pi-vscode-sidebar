import type { RpcSlashCommand } from "../../shared/rpc-types.ts";
import { asRecord, readString } from "./ui-text.ts";

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

export function resolveConversationPageEvent(data: unknown): ConversationPageEvent | undefined {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return undefined;

  if (type === "query_result") {
    return resolveQueryResultEvent(event);
  }
  if (type === "rpc_command_sent" || type === "rpc_response" || type === "message_start") {
    return { kind: "handledNoop" };
  }
  if (type === "message_update") {
    return { kind: "activityMessageUpdate", event };
  }
  if (type === "message_end") {
    return { kind: "activityMessageEnd", event };
  }
  if (isToolExecutionEvent(type)) {
    return { kind: "toolExecutionEvent", event, eventType: type };
  }
  return undefined;
}

function extractMessageArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return undefined;
  if (Array.isArray(record.messages)) return record.messages;
  const nestedData = asRecord(record.data);
  if (Array.isArray(nestedData?.messages)) return nestedData.messages;
  return undefined;
}

function extractSlashCommands(payload: unknown): RpcSlashCommand[] | undefined {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.commands)) return undefined;
  return record.commands.filter((command): command is RpcSlashCommand => {
    const item = asRecord(command);
    return !!item && typeof item.name === "string" && typeof item.source === "string";
  });
}

function isToolExecutionEvent(type: string): type is ToolExecutionEventType {
  return (
    type === "tool_execution_start" ||
    type === "tool_execution_update" ||
    type === "tool_execution_end"
  );
}

function resolveQueryResultEvent(
  event: Record<string, unknown>,
): ConversationPageEvent | undefined {
  const command = readString(event.command);
  if (command === "get_commands") {
    const commands = extractSlashCommands(event.data);
    if (!commands) return undefined;
    return { kind: "availableCommandsQueryResult", commands };
  }
  if (command !== "get_messages") return undefined;
  return {
    kind: "messageReplayQueryResult",
    messages: extractMessageArray(event.data),
    replace: event.replace === true,
  };
}
