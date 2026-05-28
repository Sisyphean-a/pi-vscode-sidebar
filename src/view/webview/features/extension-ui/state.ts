import { z } from "zod";

const ExtensionUiEnvelopeSchema = z
  .object({
    method: z.string(),
  })
  .passthrough();
const SelectRequestSchema = z
  .object({
    id: z.string().min(1),
    method: z.literal("select"),
    options: z.array(z.unknown()).optional(),
    title: z.string().optional(),
  })
  .passthrough();
const ConfirmRequestSchema = z
  .object({
    id: z.string().min(1),
    message: z.string().optional(),
    method: z.literal("confirm"),
    title: z.string().optional(),
  })
  .passthrough();
const InputRequestSchema = z
  .object({
    id: z.string().min(1),
    method: z.union([z.literal("input"), z.literal("editor")]),
    placeholder: z.string().optional(),
    prefill: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();
const NotifyRequestSchema = z
  .object({
    level: z.string().optional(),
    message: z.string().optional(),
    method: z.literal("notify"),
    notifyType: z.string().optional(),
  })
  .passthrough();
const StatusRequestSchema = z
  .object({
    method: z.literal("setStatus"),
    statusKey: z.string().optional(),
    statusText: z.string().optional(),
  })
  .passthrough();
const TitleRequestSchema = z
  .object({
    method: z.literal("setTitle"),
    title: z.string().optional(),
  })
  .passthrough();
const SetEditorTextSchema = z
  .object({
    method: z.literal("set_editor_text"),
    text: z.string().optional(),
  })
  .passthrough();

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

export function resolveExtensionUiRequest(data: unknown): ExtensionUiRequest | undefined {
  const envelope = ExtensionUiEnvelopeSchema.safeParse(data);
  if (!envelope.success) return undefined;

  const method = envelope.data.method;
  if (method === "select") return resolveSelectRequest(data);
  if (method === "confirm") return resolveConfirmRequest(data);
  if (method === "input" || method === "editor") return resolveInputRequest(data);
  if (method === "notify") return resolveNotifyRequest(data);
  if (method === "setStatus") return resolveStatusRequest(data);
  if (method === "setTitle") return resolveTitleRequest(data);
  if (method === "set_editor_text") return resolveSetEditorTextRequest(data);
  return { type: "hide" };
}

function resolveSelectRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = SelectRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "select",
    requestId: parsed.data.id,
    titleText: parsed.data.title ?? "需要选择",
    options: (parsed.data.options ?? []).filter(isString),
  };
}

function resolveConfirmRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = ConfirmRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "confirm",
    requestId: parsed.data.id,
    titleText: parsed.data.title ?? "请确认",
    message: parsed.data.message ?? "",
  };
}

function resolveInputRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = InputRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "input",
    requestId: parsed.data.id,
    titleText: parsed.data.title ?? "请输入",
    placeholder: parsed.data.placeholder ?? "",
    prefill: parsed.data.prefill ?? "",
  };
}

function resolveNotifyRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = NotifyRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  const level = parsed.data.notifyType ?? parsed.data.level ?? "info";
  return {
    type: "notify",
    noticeMessage: `[${mapNoticeLevel(level)}] ${parsed.data.message ?? "收到通知。"}`,
  };
}

function resolveStatusRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = StatusRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "status",
    statusKey: parsed.data.statusKey ?? "custom",
    statusText: parsed.data.statusText,
  };
}

function resolveTitleRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = TitleRequestSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "title",
    title: parsed.data.title,
  };
}

function resolveSetEditorTextRequest(data: unknown): ExtensionUiRequest | undefined {
  const parsed = SetEditorTextSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    type: "set_editor_text",
    text: parsed.data.text ?? "",
  };
}

function mapNoticeLevel(level: string): string {
  if (level === "info") return "信息";
  if (level === "warning" || level === "warn") return "警告";
  if (level === "error") return "错误";
  if (level === "success") return "成功";
  return "通知";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
