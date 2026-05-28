import { z } from "zod";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type RpcCommandScope = "user" | "project" | "temporary";
export type RpcCommandSource = "extension" | "prompt" | "skill";

export interface RpcSourceInfo {
  path: string;
  source: string;
  scope: RpcCommandScope;
  origin: string;
  baseDir?: string;
}

export interface RpcSlashCommand {
  name: string;
  description?: string;
  source: RpcCommandSource;
  sourceInfo: RpcSourceInfo;
}

export interface RpcImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type RpcCommand =
  | { id?: string; type: "prompt"; message: string; images?: RpcImageContent[] }
  | { id?: string; type: "steer"; message: string }
  | { id?: string; type: "follow_up"; message: string }
  | { id?: string; type: "abort" }
  | { id?: string; type: "new_session"; parentSession?: string }
  | { id?: string; type: "get_state" }
  | { id?: string; type: "set_model"; provider: string; modelId: string }
  | { id?: string; type: "get_available_models" }
  | { id?: string; type: "set_thinking_level"; level: ThinkingLevel }
  | { id?: string; type: "compact"; customInstructions?: string }
  | { id?: string; type: "get_session_stats" }
  | { id?: string; type: "get_messages" }
  | { id?: string; type: "export_html"; outputPath?: string }
  | { id?: string; type: "switch_session"; sessionPath: string }
  | { id?: string; type: "clone" }
  | { id?: string; type: "fork"; entryId: string }
  | { id?: string; type: "get_fork_messages" }
  | { id?: string; type: "get_last_assistant_text" }
  | { id?: string; type: "get_commands" }
  | { id?: string; type: "get_session_tree" }
  | { id?: string; type: "navigate_session_tree"; entryId: string }
  | { id?: string; type: "set_session_name"; name: string };

export interface RpcSessionTreeNode {
  entryId: string;
  parentEntryId?: string;
  label?: string;
  previewText: string;
  depth: number;
  isActive: boolean;
  hasChildren: boolean;
}

export interface RpcSessionState {
  model?: { provider: string; id: string };
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  sessionFile?: string;
  sessionId: string;
  sessionName?: string;
  messageCount: number;
  pendingMessageCount: number;
}

export type RpcResponse =
  | { id?: string; type: "response"; command: string; success: true; data?: unknown }
  | { id?: string; type: "response"; command: string; success: false; error: string };

export type AgentEventType =
  | "agent_start"
  | "agent_end"
  | "session_info_changed"
  | "turn_start"
  | "turn_end"
  | "thinking_level_changed"
  | "message_start"
  | "message_update"
  | "message_end"
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end";

export interface AgentEventLike {
  type: AgentEventType;
  [key: string]: unknown;
}

export type RpcExtensionUIRequest =
  | { type: "extension_ui_request"; id: string; method: "select"; title: string; options: string[] }
  | { type: "extension_ui_request"; id: string; method: "confirm"; title: string; message: string }
  | {
      type: "extension_ui_request";
      id: string;
      method: "input";
      title: string;
      placeholder?: string;
    }
  | { type: "extension_ui_request"; id: string; method: "editor"; title: string; prefill?: string }
  | { type: "extension_ui_request"; id: string; method: "notify"; message: string }
  | {
      type: "extension_ui_request";
      id: string;
      method: "setStatus";
      statusKey: string;
      statusText?: string;
    }
  | { type: "extension_ui_request"; id: string; method: "setTitle"; title: string }
  | { type: "extension_ui_request"; id: string; method: "set_editor_text"; text: string };

export type RpcExtensionUIResponse =
  | { type: "extension_ui_response"; id: string; value: string }
  | { type: "extension_ui_response"; id: string; confirmed: boolean }
  | { type: "extension_ui_response"; id: string; cancelled: true };

export type RpcOutputMessage = RpcResponse | AgentEventLike | RpcExtensionUIRequest;

const NonEmptyStringSchema = z.string().min(1);
const OptionalIdSchema = z.string().optional();
const RpcResponseSchema: z.ZodType<RpcResponse> = z.discriminatedUnion("success", [
  z.object({
    id: OptionalIdSchema,
    type: z.literal("response"),
    command: NonEmptyStringSchema,
    success: z.literal(true),
    data: z.unknown().optional(),
  }),
  z.object({
    id: OptionalIdSchema,
    type: z.literal("response"),
    command: NonEmptyStringSchema,
    success: z.literal(false),
    error: NonEmptyStringSchema,
  }),
]);
const RpcExtensionUiRequestSchema: z.ZodType<RpcExtensionUIRequest> = z.discriminatedUnion(
  "method",
  [
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("select"),
      title: NonEmptyStringSchema,
      options: z.array(z.string()),
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("confirm"),
      title: NonEmptyStringSchema,
      message: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("input"),
      title: NonEmptyStringSchema,
      placeholder: z.string().optional(),
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("editor"),
      title: NonEmptyStringSchema,
      prefill: z.string().optional(),
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("notify"),
      message: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("setStatus"),
      statusKey: NonEmptyStringSchema,
      statusText: z.string().optional(),
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("setTitle"),
      title: NonEmptyStringSchema,
    }),
    z.object({
      type: z.literal("extension_ui_request"),
      id: NonEmptyStringSchema,
      method: z.literal("set_editor_text"),
      text: z.string(),
    }),
  ],
);
const AgentEventTypeSchema = z.enum([
  "agent_start",
  "agent_end",
  "session_info_changed",
  "turn_start",
  "turn_end",
  "thinking_level_changed",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
]);
const AgentEventLikeSchema: z.ZodType<AgentEventLike> = z
  .object({ type: AgentEventTypeSchema })
  .catchall(z.unknown());

export function isRpcResponse(value: unknown): value is RpcResponse {
  return RpcResponseSchema.safeParse(value).success;
}

export function isRpcExtensionUiRequest(value: unknown): value is RpcExtensionUIRequest {
  return RpcExtensionUiRequestSchema.safeParse(value).success;
}

export function isAgentEventLike(value: unknown): value is AgentEventLike {
  return AgentEventLikeSchema.safeParse(value).success;
}
