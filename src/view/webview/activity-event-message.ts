import { asRecord, readString } from "./ui-text.ts";

export function mapStatusLabel(statusKey: string): string {
  if (statusKey === "idle") return "空闲";
  if (statusKey === "streaming") return "生成中";
  if (statusKey === "awaiting_extension_ui") return "等待确认";
  if (statusKey === "process_dead") return "进程异常";
  if (statusKey === "connected") return "已连接";
  return "状态更新";
}

export function formatEventMessage(data: unknown): string {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return JSON.stringify(data);

  if (type === "query_result") {
    return "查询结果已返回";
  }

  if (type === "tool_execution_start") {
    return withToolName("工具开始执行", event);
  }
  if (type === "tool_execution_update") {
    return withToolName("工具执行中", event);
  }
  if (type === "tool_execution_end") {
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
    extractToolName(asRecord(asRecord(event.assistantMessageEvent)?.partial));
  return name ? `${prefix}：${name}` : prefix;
}

function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const textFromMessage = extractAssistantTextFromMessage(event.message);
  if (textFromMessage) return textFromMessage;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  return extractAssistantTextFromMessage(partial);
}

function extractAssistantTextFromMessage(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  if (readString(record.role) !== "assistant") return undefined;
  const content = record.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "text") continue;
    const text = readString(entry.text);
    if (text) return text;
  }
  return undefined;
}

function extractToolName(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const content = record.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "toolCall") continue;
    return readString(entry.name);
  }
  return undefined;
}

function formatMessageStart(event: Record<string, unknown>): string {
  const role = readString(asRecord(event.message)?.role);
  if (role === "user") return "用户消息已发送";
  if (role === "assistant") return "助手开始回复";
  if (role === "toolResult") return "工具结果开始返回";
  return "消息开始";
}

function formatToolResultMessage(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  if (!message || readString(message.role) !== "toolResult") return undefined;
  const name = readString(message.toolName);
  return name ? `工具结果已返回：${name}` : "工具结果已返回";
}

function formatToolCallDelta(event: Record<string, unknown>): string | undefined {
  const assistantEvent = asRecord(event.assistantMessageEvent);
  if (!assistantEvent) return undefined;
  const eventType = readString(assistantEvent.type);
  if (!eventType || !eventType.startsWith("toolcall_")) return undefined;
  const name =
    extractToolName(asRecord(assistantEvent.partial)) ??
    extractToolName(event.message) ??
    readString(asRecord(event.message)?.toolName);
  if (eventType === "toolcall_end") return name ? `思考阶段完成：${name}` : "思考阶段完成";
  return name ? `助手思考中（调用 ${name}）` : "助手思考中";
}

function containsThinking(event: Record<string, unknown>): boolean {
  return (
    hasThinkingContent(asRecord(event.message)) ||
    hasThinkingContent(asRecord(event.assistantMessageEvent)?.partial)
  );
}

function hasThinkingContent(message: unknown): boolean {
  const record = asRecord(message);
  if (!record) return false;
  const content = record.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => readString(asRecord(item)?.type) === "thinking");
}
