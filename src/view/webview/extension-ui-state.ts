export type ExtensionUiRequest =
  | { noticeMessage: string; type: "notify" }
  | { requestId: string; titleText: string; options: string[]; type: "select" }
  | { requestId: string; titleText: string; message: string; type: "confirm" }
  | {
      requestId: string;
      titleText: string;
      placeholder: string;
      prefill: string;
      type: "input";
    }
  | { statusKey: string; statusText?: string; type: "status" }
  | { title?: string; type: "title" }
  | { text: string; type: "set_editor_text" }
  | { type: "hide" };

export function resolveExtensionUiRequest(
  data: Record<string, unknown>,
): ExtensionUiRequest | undefined {
  const requestId = readString(data.id);
  const method = readString(data.method);
  if (!method) return undefined;

  if (method === "select") {
    if (!requestId) return undefined;
    return {
      type: "select",
      requestId,
      titleText: readString(data.title) ?? "需要选择",
      options: Array.isArray(data.options)
        ? data.options.filter((value): value is string => typeof value === "string")
        : [],
    };
  }

  if (method === "confirm") {
    if (!requestId) return undefined;
    return {
      type: "confirm",
      requestId,
      titleText: readString(data.title) ?? "请确认",
      message: readString(data.message) ?? "",
    };
  }

  if (method === "input" || method === "editor") {
    if (!requestId) return undefined;
    return {
      type: "input",
      requestId,
      titleText: readString(data.title) ?? "请输入",
      placeholder: readString(data.placeholder) ?? "",
      prefill: readString(data.prefill) ?? "",
    };
  }

  if (method === "notify") {
    const message = readString(data.message) ?? "收到通知。";
    const level = readString(data.notifyType) ?? readString(data.level) ?? "info";
    return {
      type: "notify",
      noticeMessage: `[${mapNoticeLevel(level)}] ${message}`,
    };
  }

  if (method === "setStatus") {
    return {
      type: "status",
      statusKey: readString(data.statusKey) ?? "custom",
      statusText: readString(data.statusText),
    };
  }

  if (method === "setTitle") {
    return {
      type: "title",
      title: readString(data.title),
    };
  }

  if (method === "set_editor_text") {
    return {
      type: "set_editor_text",
      text: readString(data.text) ?? "",
    };
  }

  return { type: "hide" };
}

function mapNoticeLevel(level: string): string {
  if (level === "info") return "信息";
  if (level === "warning" || level === "warn") return "警告";
  if (level === "error") return "错误";
  if (level === "success") return "成功";
  return "通知";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
