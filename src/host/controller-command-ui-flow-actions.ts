import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import type { RpcCommand } from "../shared/rpc-types.ts";
import type { CommandUiItem, CommandUiRequest } from "../view/protocol.ts";
import {
  readForkCommandUiItems,
  readModelCommandUiItems,
  readModelSelection,
  readSelectedCommandUiId,
  readTreeCommandUiItems,
} from "./controller-command-ui-readers.ts";
import { toSessionCommandUiItem } from "./controller-command-ui.ts";
import type {
  PendingCommandUiKind,
  PendingCommandUiRequest,
} from "./controller-command-ui-flow-state.ts";

export type ControllerPhase = "idle" | "streaming" | "awaiting_extension_ui" | "process_dead";

interface ResumeCommandUiOpenPlan {
  kind: "resume";
  rawInput: string;
  requestKind: "session_list";
  type: "resume";
}

interface RpcBackedCommandUiOpenPlan {
  command: RpcCommand;
  emptyMessage: string;
  errorMessage: string;
  kind: Exclude<PendingCommandUiKind, "resume">;
  rawInput: string;
  readItems(data: unknown): CommandUiItem[];
  requestKind: Exclude<CommandUiRequest["kind"], "session_list">;
  type: "rpc";
}

export type CommandUiOpenPlan = ResumeCommandUiOpenPlan | RpcBackedCommandUiOpenPlan;

export type PendingCommandUiAction =
  | { type: "ignore" }
  | { type: "error"; message: string; restoreInput: string }
  | { command: RpcCommand; phase: ControllerPhase; type: "command" };

type RpcCommandUiKind = Exclude<PendingCommandUiKind, "resume">;
type RpcCommandUiOpenPlanTemplate = Omit<RpcBackedCommandUiOpenPlan, "rawInput" | "type">;

const RPC_OPEN_PLAN_BY_COMMAND: Record<RpcCommandUiKind, RpcCommandUiOpenPlanTemplate> = {
  model: {
    command: { type: "get_available_models" },
    emptyMessage: "没有可选模型",
    errorMessage: "获取模型失败",
    kind: "model",
    readItems: readModelCommandUiItems,
    requestKind: "model_list",
  },
  fork: {
    command: { type: "get_fork_messages" },
    emptyMessage: "没有可分叉的用户消息",
    errorMessage: "获取分叉列表失败",
    kind: "fork",
    readItems: readForkCommandUiItems,
    requestKind: "message_list",
  },
  tree: {
    command: { type: "get_session_tree" },
    emptyMessage: "没有可切换的树节点",
    errorMessage: "获取会话树失败",
    kind: "tree",
    readItems: readTreeCommandUiItems,
    requestKind: "session_tree",
  },
};

export function resolveCommandUiOpenPlan(
  commandName: string,
  rawInput: string,
): CommandUiOpenPlan | undefined {
  if (commandName === "resume") {
    return {
      type: "resume",
      kind: "resume",
      rawInput,
      requestKind: "session_list",
    };
  }
  const plan = readRpcCommandUiOpenPlan(commandName);
  if (!plan) return undefined;
  return { type: "rpc", rawInput, ...plan };
}

export function resolvePendingCommandUiAction(
  pending: PendingCommandUiRequest,
  payload: unknown,
  currentPhase: ControllerPhase,
): PendingCommandUiAction {
  const selectedId = readSelectedCommandUiId(payload);
  if (!selectedId && pending.kind !== "model") {
    return { type: "ignore" };
  }

  if (pending.kind === "resume" && selectedId) {
    return {
      type: "command",
      command: { type: "switch_session", sessionPath: selectedId },
      phase: "idle",
    };
  }

  if (pending.kind === "model") {
    const modelSelection = readModelSelection(payload);
    if (!modelSelection) {
      return {
        type: "error",
        message: "模型选择无效",
        restoreInput: pending.rawInput,
      };
    }
    return {
      type: "command",
      command: {
        type: "set_model",
        provider: modelSelection.provider,
        modelId: modelSelection.modelId,
      },
      phase: currentPhase,
    };
  }

  if (pending.kind === "fork" && selectedId) {
    return {
      type: "command",
      command: { type: "fork", entryId: selectedId },
      phase: "idle",
    };
  }

  if (pending.kind === "tree" && selectedId) {
    return {
      type: "command",
      command: { type: "navigate_session_tree", entryId: selectedId },
      phase: "idle",
    };
  }

  return { type: "ignore" };
}

export function toResumeCommandUiItems(sessions: RecentSessionSummary[]): CommandUiItem[] {
  return sessions.map(toSessionCommandUiItem);
}

function readRpcCommandUiOpenPlan(commandName: string): RpcCommandUiOpenPlanTemplate | undefined {
  return RPC_OPEN_PLAN_BY_COMMAND[commandName as RpcCommandUiKind];
}
