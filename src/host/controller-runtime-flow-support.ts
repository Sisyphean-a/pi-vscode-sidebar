import type { HostToUiMessage } from "../view/protocol.ts";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import type { RpcCommand, RpcSessionState } from "../shared/rpc-types.ts";
import type { RpcSessionViewState } from "./state-store.ts";

export function buildRuntimeStateMessage(
  view: RpcSessionViewState,
  rpc?: RpcSessionState,
  recentSessions?: RecentSessionSummary[],
): HostToUiMessage {
  return {
    type: "state",
    data: {
      view,
      rpc,
      recentSessions,
    },
  };
}

export function buildRuntimeQueryResultEvent(
  command: RpcCommand["type"],
  data: unknown,
  correlationId: string | undefined,
): HostToUiMessage {
  return {
    type: "event",
    data: {
      type: "query_result",
      command,
      data,
      correlationId,
    },
  };
}

export function shouldEmitRuntimeQueryResult(commandType: RpcCommand["type"]): boolean {
  return commandType === "set_model" || commandType === "set_thinking_level";
}

export function shouldReplayRuntimeMessages(commandType: RpcCommand["type"]): boolean {
  return (
    commandType === "new_session" ||
    commandType === "switch_session" ||
    commandType === "clone" ||
    commandType === "fork" ||
    commandType === "navigate_session_tree"
  );
}

export function withRuntimeCommandId(
  command: RpcCommand,
  correlationId: string | undefined,
): RpcCommand {
  if (!correlationId || command.id) return command;
  return { ...command, id: correlationId };
}
