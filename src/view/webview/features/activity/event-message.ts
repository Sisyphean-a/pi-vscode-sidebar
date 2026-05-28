import { z } from "zod";
import {
  readAssistantEventPartial,
  readMessageContentEntries,
  readRecord,
  readString,
  readToolExecutionEventType,
} from "./event-zod.ts";

const TextContentEntrySchema = z
  .object({
    type: z.literal("text"),
    text: z.string().optional(),
  })
  .catchall(z.unknown());

const ToolCallContentEntrySchema = z
  .object({
    type: z.literal("toolCall"),
    name: z.string().optional(),
  })
  .catchall(z.unknown());

export function mapStatusLabel(statusKey: string): string {
  if (statusKey === "idle") return "空闲";
  if (statusKey === "streaming") return "生成中";
  if (statusKey === "awaiting_extension_ui") return "等待确认";
  if (statusKey === "process_dead") return "进程异常";
  if (statusKey === "connected") return "已连接";
  return "状态更新";
}

export function formatEventMessage(data: unknown): string {
  const event = readRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return JSON.stringify(data);

  if (type === "query_result") {
    return "查询结果已返回";
  }

  const toolExecutionType = readToolExecutionEventType(type);
  if (toolExecutionType === "tool_execution_start") {
    return withToolName("工具开始执行", event);
  }
  if (toolExecutionType === "tool_execution_update") {
    return withToolName("工具执行中", event);
  }
  if (toolExecutionType === "tool_execution_end") {
    return withToolName("工具执行完成", event);
  }
  if (type === "turn_start") return "开始新一轮对话";
  if (type === "turn_end") return "本轮对话已完成";
  if (type === "message_start") return formatMessageStart(event);
  if (type === "message_end") {
    const toolResult = formatToolResultMessage(event);
    if (toolResult) return toolResult;
    const text = extractAssistantText(event);
    return text ? `助手：${text.slice(0, 160)}` : "助手消息结束";
  }
  if (type === "message_update") {
    const toolCall = formatToolCallDelta(event);
    if (toolCall) return toolCall;
    if (containsThinking(event)) return "助手思考中";
    const text = extractAssistantText(event) ?? readString(event?.text);
    return text ? `助手：${text.slice(0, 160)}` : "助手消息更新";
  }
  if (type === "agent_start") return "智能体已启动";
  if (type === "agent_end") return "智能体已结束";
  return "收到事件更新";
}

function withToolName(prefix: string, event: Record<string, unknown>): string {
  const name =
    readString(event.toolName) ??
    extractToolName(event.message) ??
    extractToolName(readAssistantEventPartial(event));
  return name ? `${prefix}：${name}` : prefix;
}

function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const textFromMessage = extractAssistantTextFromMessage(event.message);
  if (textFromMessage) return textFromMessage;
  const partial = readAssistantEventPartial(event);
  return extractAssistantTextFromMessage(partial);
}

function extractAssistantTextFromMessage(message: unknown): string | undefined {
  const record = readRecord(message);
  if (!record) return undefined;
  if (readString(record.role) !== "assistant") return undefined;
  const contentEntries = readMessageContentEntries(record);
  if (!contentEntries) return undefined;
  for (const entry of contentEntries) {
    const parsedEntry = TextContentEntrySchema.safeParse(entry);
    if (!parsedEntry.success || !parsedEntry.data.text) continue;
    return parsedEntry.data.text;
  }
  return undefined;
}

function extractToolName(message: unknown): string | undefined {
  const contentEntries = readMessageContentEntries(message);
  if (!contentEntries) return undefined;
  for (const entry of contentEntries) {
    const parsedEntry = ToolCallContentEntrySchema.safeParse(entry);
    if (!parsedEntry.success || !parsedEntry.data.name) continue;
    return parsedEntry.data.name;
  }
  return undefined;
}

function formatMessageStart(event: Record<string, unknown>): string {
  const role = readString(readRecord(event.message)?.role);
  if (role === "user") return "用户消息已发送";
  if (role === "assistant") return "助手开始回复";
  if (role === "toolResult") return "工具结果开始返回";
  return "消息开始";
}

function formatToolResultMessage(event: Record<string, unknown>): string | undefined {
  const message = readRecord(event.message);
  if (!message || readString(message.role) !== "toolResult") return undefined;
  const name = readString(message.toolName);
  return name ? `工具结果已返回：${name}` : "工具结果已返回";
}

function formatToolCallDelta(event: Record<string, unknown>): string | undefined {
  const assistantEvent = readRecord(event.assistantMessageEvent);
  if (!assistantEvent) return undefined;
  const eventType = readString(assistantEvent.type);
  if (!eventType || !eventType.startsWith("toolcall_")) return undefined;
  const name =
    extractToolName(readAssistantEventPartial(event)) ??
    extractToolName(event.message) ??
    readString(readRecord(event.message)?.toolName);
  if (eventType === "toolcall_end") return name ? `思考阶段完成：${name}` : "思考阶段完成";
  return name ? `助手思考中（调用 ${name}）` : "助手思考中";
}

function containsThinking(event: Record<string, unknown>): boolean {
  return hasThinkingContent(event.message) || hasThinkingContent(readAssistantEventPartial(event));
}

function hasThinkingContent(message: unknown): boolean {
  const contentEntries = readMessageContentEntries(message);
  if (!contentEntries) return false;
  return contentEntries.some((entry) => readString(entry.type) === "thinking");
}
