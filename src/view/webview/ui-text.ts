export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

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
  if (!type) return JSON.stringify(data);

  if (type === "query_result") {
    return "查询结果已返回";
  }

  if (type === "tool_execution_start") {
    return "工具开始执行";
  }
  if (type === "tool_execution_update") {
    return "工具执行中";
  }
  if (type === "tool_execution_end") {
    return "工具执行完成";
  }
  if (type === "message_update") {
    const text = readString(event?.text);
    return text ? `助手：${text.slice(0, 160)}` : "助手消息更新";
  }
  if (type === "agent_start") return "智能体已启动";
  if (type === "agent_end") return "智能体已结束";
  return "收到事件更新";
}
