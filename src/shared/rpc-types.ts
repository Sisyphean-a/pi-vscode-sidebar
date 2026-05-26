export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type RpcCommand =
  | { id?: string; type: "prompt"; message: string; images?: Array<{ path: string }> }
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

export function isRpcResponse(value: unknown): value is RpcResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.type === "response" && typeof record.command === "string";
}

export function isRpcExtensionUiRequest(value: unknown): value is RpcExtensionUIRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.type === "extension_ui_request" && typeof record.id === "string";
}

export function isAgentEventLike(value: unknown): value is AgentEventLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string") return false;
  return EVENT_TYPES.has(record.type as AgentEventType);
}

const EVENT_TYPES = new Set<AgentEventType>([
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
