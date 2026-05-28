import type { HostToUiMessage } from "../../view/protocol.ts";
import type { RpcCommand, RpcSlashCommand } from "../../shared/rpc-types.ts";
import { readSlashCommands } from "../command/ui/readers.ts";
import {
  buildControllerRpcQueryResultEvent,
  createControllerRpcFlowState,
  getDynamicSlashCommand,
  isUnsupportedGetMessagesError,
  needsDynamicSlashCommandRefresh,
  rememberDynamicSlashCommands,
} from "./flow-support.ts";

interface RpcResponseLike {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface CreateControllerRpcFlowOptions {
  emit(message: HostToUiMessage): void;
  ensureStarted(): Promise<void>;
  reportCommandFailure(
    response: { success: boolean; error?: string },
    correlationId?: string,
  ): void;
  sendRpcCommand(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
  sendRpcRequest(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
  syncState(): Promise<void>;
}

export interface ControllerRpcFlow {
  findDynamicSlashCommand(
    name: string,
    correlationId: string | undefined,
  ): Promise<RpcSlashCommand | undefined>;
  onPromptSlashCommand(rawInput: string, correlationId: string | undefined): Promise<void>;
  onRpcQuery(command: RpcCommand, correlationId: string | undefined): Promise<void>;
  onUiReady(correlationId: string | undefined): Promise<void>;
  replayMessages(correlationId: string | undefined, replace: boolean): Promise<void>;
}

export function createControllerRpcFlow(
  options: CreateControllerRpcFlowOptions,
): ControllerRpcFlow {
  const state = createControllerRpcFlowState();

  return {
    async findDynamicSlashCommand(name, correlationId) {
      if (needsDynamicSlashCommandRefresh(state, name)) {
        await refreshAvailableSlashCommands(correlationId, false);
      }
      return getDynamicSlashCommand(state, name);
    },
    async onPromptSlashCommand(rawInput, correlationId) {
      const response = await options.sendRpcCommand(
        { type: "prompt", message: rawInput },
        correlationId,
      );
      options.reportCommandFailure(response, correlationId);
      if (response.success) {
        await options.syncState();
      }
    },
    async onRpcQuery(command, correlationId) {
      const response = await options.sendRpcCommand(command, correlationId);
      options.reportCommandFailure(response, correlationId);
      if (!response.success) return;
      options.emit(buildControllerRpcQueryResultEvent(command.type, response.data, correlationId));
      await options.syncState();
    },
    async onUiReady(correlationId) {
      await options.ensureStarted();
      await options.syncState();
      await replayMessages(correlationId, true);
      await refreshAvailableSlashCommands(correlationId, true);
    },
    replayMessages,
  };

  async function replayMessages(
    correlationId: string | undefined,
    replace: boolean,
  ): Promise<void> {
    const response = await options.sendRpcRequest({ type: "get_messages" }, correlationId);
    if (!response.success) {
      if (isUnsupportedGetMessagesError(response.error)) return;
      options.reportCommandFailure(response, correlationId);
      return;
    }
    options.emit(
      buildControllerRpcQueryResultEvent("get_messages", response.data, correlationId, replace),
    );
  }

  async function refreshAvailableSlashCommands(
    correlationId: string | undefined,
    emitEvent: boolean,
  ): Promise<void> {
    const response = await options.sendRpcCommand({ type: "get_commands" }, correlationId);
    options.reportCommandFailure(response, correlationId);
    if (!response.success) return;
    rememberDynamicSlashCommands(state, readSlashCommands(response.data));
    if (!emitEvent) return;
    options.emit(buildControllerRpcQueryResultEvent("get_commands", response.data, correlationId));
  }
}
