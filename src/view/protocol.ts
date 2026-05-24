export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface UiImageInput {
  path: string;
}

export type UiToHostMessage =
  | { type: "ui_ready" }
  | { type: "send_prompt"; text: string; images?: UiImageInput[] }
  | { type: "abort" }
  | { type: "new_session" }
  | { type: "switch_session"; sessionPath: string }
  | { type: "set_session_name"; name: string }
  | { type: "export_html"; outputPath?: string }
  | { type: "get_available_models" }
  | { type: "get_session_stats" }
  | { type: "set_model"; provider: string; modelId: string }
  | { type: "set_thinking_level"; level: ThinkingLevel }
  | { type: "respond_extension_ui"; requestId: string; payload: unknown };

export type HostToUiMessage =
  | { type: "state"; data: unknown }
  | { type: "event"; data: unknown }
  | { type: "extension_ui_request"; data: unknown }
  | { type: "error"; scope: "rpc" | "bridge" | "ui"; message: string }
  | { type: "notice"; message: string };

export function parseUiMessage(input: unknown): UiToHostMessage | undefined {
  const message = asRecord(input);
  if (!message) return undefined;

  const type = readString(message.type);
  if (!type) return undefined;

  switch (type) {
    case "ui_ready":
    case "abort":
    case "new_session":
      return { type };
    case "send_prompt":
      return parseSendPrompt(message);
    case "switch_session":
      return parseSwitchSession(message);
    case "set_session_name":
      return parseSessionName(message);
    case "export_html":
      return parseExportHtml(message);
    case "get_available_models":
      return { type: "get_available_models" };
    case "get_session_stats":
      return { type: "get_session_stats" };
    case "set_model":
      return parseSetModel(message);
    case "set_thinking_level":
      return parseThinkingLevel(message);
    case "respond_extension_ui":
      return parseExtensionUiResponse(message);
    default:
      return undefined;
  }
}

function parseSessionName(message: Record<string, unknown>): UiToHostMessage | undefined {
  const name = readString(message.name);
  if (!name) return undefined;
  return { type: "set_session_name", name };
}

function parseExportHtml(message: Record<string, unknown>): UiToHostMessage {
  const outputPath = readString(message.outputPath);
  return outputPath ? { type: "export_html", outputPath } : { type: "export_html" };
}

function parseSendPrompt(message: Record<string, unknown>): UiToHostMessage | undefined {
  const text = readString(message.text);
  if (!text) return undefined;
  const images = parseImages(message.images);
  if (message.images !== undefined && !images) return undefined;
  return images ? { type: "send_prompt", text, images } : { type: "send_prompt", text };
}

function parseSwitchSession(message: Record<string, unknown>): UiToHostMessage | undefined {
  const sessionPath = readString(message.sessionPath);
  if (!sessionPath) return undefined;
  return { type: "switch_session", sessionPath };
}

function parseSetModel(message: Record<string, unknown>): UiToHostMessage | undefined {
  const provider = readString(message.provider);
  const modelId = readString(message.modelId);
  if (!provider || !modelId) return undefined;
  return { type: "set_model", provider, modelId };
}

function parseThinkingLevel(message: Record<string, unknown>): UiToHostMessage | undefined {
  const level = readString(message.level);
  if (!isThinkingLevel(level)) return undefined;
  return { type: "set_thinking_level", level };
}

function parseExtensionUiResponse(message: Record<string, unknown>): UiToHostMessage | undefined {
  const requestId = readString(message.requestId);
  if (!requestId) return undefined;
  return { type: "respond_extension_ui", requestId, payload: message.payload };
}

function parseImages(input: unknown): UiImageInput[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return undefined;
  const images: UiImageInput[] = [];
  for (const item of input) {
    const image = asRecord(item);
    const path = image ? readString(image.path) : undefined;
    if (!path) return undefined;
    images.push({ path });
  }
  return images;
}

function isThinkingLevel(level: string | undefined): level is ThinkingLevel {
  return (
    level === "off" ||
    level === "minimal" ||
    level === "low" ||
    level === "medium" ||
    level === "high" ||
    level === "xhigh"
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
