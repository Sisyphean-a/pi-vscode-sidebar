export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface UiImageInput {
  path: string;
}

type UiToHostMessagePayload =
  | { type: "ui_ready" }
  | { type: "send_prompt"; text: string; images?: UiImageInput[] }
  | { type: "open_file_reference"; path: string; startLine: number; endLine?: number }
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

export type UiToHostMessage = UiToHostMessagePayload & { correlationId?: string };

export type HostToUiMessage =
  | { type: "state"; data: unknown }
  | { type: "event"; data: unknown }
  | { type: "insert_prompt_reference"; data: unknown }
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
      return withCorrelation({ type }, message);
    case "send_prompt":
      return withOptionalCorrelation(parseSendPrompt(message), message);
    case "open_file_reference":
      return withOptionalCorrelation(parseOpenFileReference(message), message);
    case "switch_session":
      return withOptionalCorrelation(parseSwitchSession(message), message);
    case "set_session_name":
      return withOptionalCorrelation(parseSessionName(message), message);
    case "export_html":
      return withCorrelation(parseExportHtml(message), message);
    case "get_available_models":
      return withCorrelation({ type: "get_available_models" }, message);
    case "get_session_stats":
      return withCorrelation({ type: "get_session_stats" }, message);
    case "set_model":
      return withOptionalCorrelation(parseSetModel(message), message);
    case "set_thinking_level":
      return withOptionalCorrelation(parseThinkingLevel(message), message);
    case "respond_extension_ui":
      return withOptionalCorrelation(parseExtensionUiResponse(message), message);
    default:
      return undefined;
  }
}

function parseSessionName(message: Record<string, unknown>): UiToHostMessagePayload | undefined {
  const name = readString(message.name);
  if (!name) return undefined;
  return { type: "set_session_name", name };
}

function parseExportHtml(message: Record<string, unknown>): UiToHostMessagePayload {
  const outputPath = readString(message.outputPath);
  return outputPath ? { type: "export_html", outputPath } : { type: "export_html" };
}

function parseSendPrompt(message: Record<string, unknown>): UiToHostMessagePayload | undefined {
  const text = readString(message.text);
  if (!text) return undefined;
  const images = parseImages(message.images);
  if (message.images !== undefined && !images) return undefined;
  return images ? { type: "send_prompt", text, images } : { type: "send_prompt", text };
}

function parseSwitchSession(message: Record<string, unknown>): UiToHostMessagePayload | undefined {
  const sessionPath = readString(message.sessionPath);
  if (!sessionPath) return undefined;
  return { type: "switch_session", sessionPath };
}

function parseOpenFileReference(
  message: Record<string, unknown>,
): UiToHostMessagePayload | undefined {
  const path = readString(message.path);
  const startLine = readNumber(message.startLine);
  const endLine = readOptionalNumber(message.endLine);
  if (!path || startLine === undefined) return undefined;
  return endLine === undefined
    ? { type: "open_file_reference", path, startLine }
    : { type: "open_file_reference", path, startLine, endLine };
}

function parseSetModel(message: Record<string, unknown>): UiToHostMessagePayload | undefined {
  const provider = readString(message.provider);
  const modelId = readString(message.modelId);
  if (!provider || !modelId) return undefined;
  return { type: "set_model", provider, modelId };
}

function parseThinkingLevel(message: Record<string, unknown>): UiToHostMessagePayload | undefined {
  const level = readString(message.level);
  if (!isThinkingLevel(level)) return undefined;
  return { type: "set_thinking_level", level };
}

function parseExtensionUiResponse(
  message: Record<string, unknown>,
): UiToHostMessagePayload | undefined {
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

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return readNumber(value);
}

function withOptionalCorrelation<TMessage extends UiToHostMessagePayload>(
  message: TMessage | undefined,
  payload: Record<string, unknown>,
): UiToHostMessage | undefined {
  if (!message) return undefined;
  return withCorrelation(message, payload);
}

function withCorrelation<TMessage extends UiToHostMessagePayload>(
  message: TMessage,
  payload: Record<string, unknown>,
): UiToHostMessage {
  const correlationId = readString(payload.correlationId);
  if (!correlationId) return message;
  return { ...message, correlationId };
}
