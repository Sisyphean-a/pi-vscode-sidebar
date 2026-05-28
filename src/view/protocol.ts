import { z } from "zod";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export interface UiImageInput {
  type: "image";
  data: string;
  mimeType: string;
}

export interface UiPendingImageAttachment {
  id: string;
  name: string;
  previewUrl: string;
  image: UiImageInput;
}

export interface CommandUiItem {
  id: string;
  label: string;
  detail?: string;
  depth?: number;
  active?: boolean;
  payload?: Record<string, unknown>;
}

export type CommandUiKind = "session_list" | "model_list" | "message_list" | "session_tree";

export interface CommandUiRequest {
  id: string;
  kind: CommandUiKind;
  items: CommandUiItem[];
}

export interface CommandResult {
  status: "success" | "error";
  message?: string;
  restoreInput?: string;
  copyText?: string;
}

type UiToHostMessagePayload =
  | { type: "ui_ready" }
  | { type: "send_prompt"; text: string; images?: UiImageInput[] }
  | { type: "pick_image_attachments" }
  | { type: "store_pasted_image_attachment"; dataUrl: string; mimeType: string; name?: string }
  | { type: "run_command"; name: string; rawInput: string; args?: Record<string, unknown> }
  | { type: "respond_command_ui"; requestId: string; payload: unknown }
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
  | { type: "image_attachments_added"; data: { attachments: UiPendingImageAttachment[] } }
  | { type: "extension_ui_request"; data: Record<string, unknown> }
  | { type: "command_ui_request"; data: CommandUiRequest }
  | { type: "command_result"; data: CommandResult }
  | { type: "error"; scope: "rpc" | "bridge" | "ui"; message: string }
  | { type: "notice"; message: string };

const NonEmptyStringSchema = z.string().min(1);
const UiImageInputSchema: z.ZodType<UiImageInput> = z.object({
  type: z.literal("image"),
  data: NonEmptyStringSchema,
  mimeType: NonEmptyStringSchema,
});
const PlainObjectSchema: z.ZodType<Record<string, unknown>> = z.object({}).catchall(z.unknown());
const CorrelationCarrierSchema = z.object({
  correlationId: NonEmptyStringSchema,
});
const CommandUiItemSchema: z.ZodType<CommandUiItem> = z.object({
  id: NonEmptyStringSchema,
  label: NonEmptyStringSchema,
  detail: z.string().optional(),
  depth: z.number().finite().optional(),
  active: z.boolean().optional(),
  payload: PlainObjectSchema.optional(),
});
const CommandUiRequestSchema: z.ZodType<CommandUiRequest> = z.object({
  id: NonEmptyStringSchema,
  kind: z.enum(["session_list", "model_list", "message_list", "session_tree"]),
  items: z.array(CommandUiItemSchema),
});
const CommandResultSchema: z.ZodType<CommandResult> = z.object({
  status: z.enum(["success", "error"]),
  message: z.string().optional(),
  restoreInput: z.string().optional(),
  copyText: z.string().optional(),
});
const UiPendingImageAttachmentSchema: z.ZodType<UiPendingImageAttachment> = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  previewUrl: NonEmptyStringSchema,
  image: UiImageInputSchema,
});
const UiToHostMessagePayloadSchema: z.ZodType<UiToHostMessagePayload> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("ui_ready") }),
    z.object({ type: z.literal("abort") }),
    z.object({ type: z.literal("new_session") }),
    z.object({ type: z.literal("pick_image_attachments") }),
    z.object({
      type: z.literal("send_prompt"),
      text: NonEmptyStringSchema,
      images: z.array(UiImageInputSchema).optional(),
    }),
    z.object({
      type: z.literal("store_pasted_image_attachment"),
      dataUrl: NonEmptyStringSchema,
      mimeType: NonEmptyStringSchema,
      name: NonEmptyStringSchema.optional(),
    }),
    z.object({
      type: z.literal("run_command"),
      name: NonEmptyStringSchema,
      rawInput: NonEmptyStringSchema,
      args: PlainObjectSchema.optional(),
    }),
    z.object({
      type: z.literal("respond_command_ui"),
      requestId: NonEmptyStringSchema,
      payload: z.unknown(),
    }),
    z.object({
      type: z.literal("open_file_reference"),
      path: NonEmptyStringSchema,
      startLine: z.number().finite(),
      endLine: z.number().finite().optional(),
    }),
    z.object({
      type: z.literal("switch_session"),
      sessionPath: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("set_session_name"),
      name: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("export_html"),
      outputPath: z.string().optional(),
    }),
    z.object({ type: z.literal("get_available_models") }),
    z.object({ type: z.literal("get_session_stats") }),
    z.object({
      type: z.literal("set_model"),
      provider: NonEmptyStringSchema,
      modelId: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("set_thinking_level"),
      level: z.enum(THINKING_LEVELS),
    }),
    z.object({
      type: z.literal("respond_extension_ui"),
      requestId: NonEmptyStringSchema,
      payload: z.unknown(),
    }),
  ],
);
const HostToUiMessageSchema: z.ZodType<HostToUiMessage> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), data: z.unknown() }),
  z.object({ type: z.literal("event"), data: z.unknown() }),
  z.object({ type: z.literal("insert_prompt_reference"), data: z.unknown() }),
  z.object({
    type: z.literal("image_attachments_added"),
    data: z.object({ attachments: z.array(UiPendingImageAttachmentSchema) }),
  }),
  z.object({ type: z.literal("extension_ui_request"), data: PlainObjectSchema }),
  z.object({ type: z.literal("command_ui_request"), data: CommandUiRequestSchema }),
  z.object({ type: z.literal("command_result"), data: CommandResultSchema }),
  z.object({
    type: z.literal("error"),
    scope: z.enum(["rpc", "bridge", "ui"]),
    message: NonEmptyStringSchema,
  }),
  z.object({ type: z.literal("notice"), message: NonEmptyStringSchema }),
]);

export function parseUiMessage(input: unknown): UiToHostMessage | undefined {
  const parsed = UiToHostMessagePayloadSchema.safeParse(input);
  if (!parsed.success) return undefined;
  return withCorrelation(parsed.data, input);
}

export function parseHostMessage(input: unknown): HostToUiMessage | undefined {
  const parsed = HostToUiMessageSchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}

function withCorrelation<TMessage extends UiToHostMessagePayload>(
  message: TMessage,
  rawInput: unknown,
): UiToHostMessage {
  const correlationId = readCorrelationId(rawInput);
  if (!correlationId) return message;
  return { ...message, correlationId };
}

function readCorrelationId(input: unknown): string | undefined {
  const parsed = CorrelationCarrierSchema.safeParse(input);
  return parsed.success ? parsed.data.correlationId : undefined;
}
