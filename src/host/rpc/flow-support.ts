import type { HostToUiMessage } from "../../view/protocol.ts";
import type { RpcCommand, RpcSlashCommand } from "../../shared/rpc-types.ts";

export interface ControllerRpcFlowState {
  availableSlashCommands: Map<string, RpcSlashCommand>;
  hasLoadedSlashCommands: boolean;
}

export function createControllerRpcFlowState(): ControllerRpcFlowState {
  return {
    availableSlashCommands: new Map<string, RpcSlashCommand>(),
    hasLoadedSlashCommands: false,
  };
}

export function needsDynamicSlashCommandRefresh(
  state: ControllerRpcFlowState,
  name: string,
): boolean {
  return !state.hasLoadedSlashCommands || !state.availableSlashCommands.has(name);
}

export function getDynamicSlashCommand(
  state: ControllerRpcFlowState,
  name: string,
): RpcSlashCommand | undefined {
  return state.availableSlashCommands.get(name);
}

export function rememberDynamicSlashCommands(
  state: ControllerRpcFlowState,
  commands: RpcSlashCommand[],
): void {
  state.availableSlashCommands.clear();
  for (const command of commands) {
    state.availableSlashCommands.set(command.name, command);
  }
  state.hasLoadedSlashCommands = true;
}

export function buildControllerRpcQueryResultEvent(
  command: RpcCommand["type"],
  data: unknown,
  correlationId: string | undefined,
  replace?: boolean,
): HostToUiMessage {
  return {
    type: "event",
    data:
      replace === undefined
        ? { type: "query_result", command, data, correlationId }
        : { type: "query_result", command, data, correlationId, replace },
  };
}

export function isUnsupportedGetMessagesError(error: string | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("unknown rpc command") ||
    normalized.includes("unknown command") ||
    normalized.includes("unsupported")
  );
}
