import type { RecentSessionSummary } from "../../../shared/recent-sessions.ts";
import type { CommandUiItem, CommandUiRequest } from "../../../view/protocol.ts";
import { createCommandUiRequestId } from "./helpers.ts";
import {
  resolveCommandUiOpenPlan,
  resolvePendingCommandUiAction,
  toResumeCommandUiItems,
  type CommandUiOpenPlan,
  type ControllerPhase,
} from "./actions.ts";
import {
  createCommandUiFlowState,
  rememberPendingCommandUiRequest,
  takePendingCommandUiRequest,
  type PendingCommandUiKind,
} from "./state.ts";
import type { RpcCommand } from "../../../shared/rpc-types.ts";

interface RpcResponseLike {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface CreateCommandUiFlowOptions {
  emitCommandError(message: string, restoreInput: string): void;
  emitCommandUiRequest(id: string, kind: CommandUiRequest["kind"], items: CommandUiItem[]): void;
  getCurrentPhase(): ControllerPhase;
  listRecentSessions?(): Promise<RecentSessionSummary[]>;
  onSimpleCommand(
    command: RpcCommand,
    phase: ControllerPhase,
    correlationId: string | undefined,
  ): Promise<void>;
  reportCommandFailure(response: RpcResponseLike, correlationId: string | undefined): void;
  sendRpcCommand(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
}

export interface CommandUiFlow {
  handleResponse(
    requestId: string,
    payload: unknown,
    correlationId: string | undefined,
  ): Promise<void>;
  open(commandName: string, rawInput: string, correlationId: string | undefined): Promise<boolean>;
}

export function createCommandUiFlow(options: CreateCommandUiFlowOptions): CommandUiFlow {
  const state = createCommandUiFlowState();

  return {
    async handleResponse(requestId, payload, correlationId) {
      const pending = takePendingCommandUiRequest(state, requestId);
      if (!pending) return;
      const action = resolvePendingCommandUiAction(pending, payload, options.getCurrentPhase());
      if (action.type === "ignore") return;
      if (action.type === "error") {
        options.emitCommandError(action.message, action.restoreInput);
        return;
      }
      await options.onSimpleCommand(action.command, action.phase, correlationId);
    },
    async open(commandName, rawInput, correlationId) {
      const plan = resolveCommandUiOpenPlan(commandName, rawInput);
      if (!plan) return false;
      if (plan.type === "resume") {
        await openResumeCommandUi(plan);
        return true;
      }
      await openRpcBackedCommandUi(plan, correlationId);
      return true;
    },
  };

  async function openResumeCommandUi(
    plan: Extract<CommandUiOpenPlan, { type: "resume" }>,
  ): Promise<void> {
    const sessions = (await options.listRecentSessions?.()) ?? [];
    if (sessions.length === 0) {
      options.emitCommandError("没有可恢复的会话", plan.rawInput);
      return;
    }
    registerPendingRequest(
      plan.kind,
      plan.rawInput,
      plan.requestKind,
      toResumeCommandUiItems(sessions),
    );
  }

  async function openRpcBackedCommandUi(
    config: Extract<CommandUiOpenPlan, { type: "rpc" }>,
    correlationId: string | undefined,
  ): Promise<void> {
    const response = await options.sendRpcCommand(config.command, correlationId);
    if (!response.success) {
      options.reportCommandFailure(response, correlationId);
      options.emitCommandError(response.error ?? config.errorMessage, config.rawInput);
      return;
    }

    const items = config.readItems(response.data);
    if (items.length === 0) {
      options.emitCommandError(config.emptyMessage, config.rawInput);
      return;
    }

    registerPendingRequest(config.kind, config.rawInput, config.requestKind, items);
  }

  function registerPendingRequest(
    kind: PendingCommandUiKind,
    rawInput: string,
    requestKind: CommandUiRequest["kind"],
    items: CommandUiItem[],
  ): void {
    const requestId = createCommandUiRequestId();
    rememberPendingCommandUiRequest(state, requestId, { kind, rawInput });
    options.emitCommandUiRequest(requestId, requestKind, items);
  }
}
