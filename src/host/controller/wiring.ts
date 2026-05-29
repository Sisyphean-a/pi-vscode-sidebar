import { createCommandRoutingFlow, type CommandRoutingFlow } from "../command/routing.ts";
import { createCommandUiFlow, type CommandUiFlow } from "../command/ui/flow.ts";
import { createDirectCommandFlow, type DirectCommandFlow } from "../command/direct-flow.ts";
import { createProcessEventFlow, type ProcessEventFlow } from "./process-events.ts";
import { createControllerRpcFlow, type ControllerRpcFlow } from "../rpc/flow.ts";
import { createControllerRuntimeFlow, type ControllerRuntimeFlow } from "../runtime/flow.ts";
import {
  createControllerUiMessageRouter,
  type ControllerUiMessageRouter,
} from "./ui-message-router.ts";
import type { SidebarControllerOptions } from "../controller.ts";
import type {
  CommandResult,
  CommandUiItem,
  CommandUiRequest,
  HostToUiMessage,
} from "../../view/protocol.ts";

interface FailureResponse {
  success: boolean;
  error?: string;
}

interface CreateSidebarControllerWiringOptions {
  controllerOptions: SidebarControllerOptions;
  emit(message: HostToUiMessage): void;
  emitCommandError(message: string, restoreInput: string): void;
  emitCommandResult(data: CommandResult): void;
  emitCommandUiRequest(id: string, kind: CommandUiRequest["kind"], items: CommandUiItem[]): void;
  reportCommandFailure(response: FailureResponse, correlationId?: string): void;
}

export interface SidebarControllerWiring {
  commandRoutingFlow: CommandRoutingFlow;
  commandUiFlow: CommandUiFlow;
  directCommandFlow: DirectCommandFlow;
  processEventFlow: ProcessEventFlow;
  rpcFlow: ControllerRpcFlow;
  runtimeFlow: ControllerRuntimeFlow;
  uiMessageRouter: ControllerUiMessageRouter;
  unsubscribe: () => void;
}

interface ControllerFlowBundle {
  commandRoutingFlow: CommandRoutingFlow;
  commandUiFlow: CommandUiFlow;
  directCommandFlow: DirectCommandFlow;
  processEventFlow: ProcessEventFlow;
  rpcFlow: ControllerRpcFlow;
  runtimeFlow: ControllerRuntimeFlow;
}

interface ControllerRuntimeRpcBundle {
  rpcFlow: ControllerRpcFlow;
  runtimeFlow: ControllerRuntimeFlow;
}

interface ControllerCommandBundle {
  commandRoutingFlow: CommandRoutingFlow;
  commandUiFlow: CommandUiFlow;
  directCommandFlow: DirectCommandFlow;
}

const DEFAULT_EXTENSION_UI_TIMEOUT_MS = 120000;

export function createSidebarControllerWiring(
  options: CreateSidebarControllerWiringOptions,
): SidebarControllerWiring {
  const extensionUiTimeoutMs = normalizeTimeoutMs(options.controllerOptions.extensionUiTimeoutMs);
  const flows = createControllerFlowBundle(options, extensionUiTimeoutMs);
  const unsubscribe = options.controllerOptions.processManager.onEvent((event) => {
    void flows.processEventFlow.handleProcessEvent(event);
  });
  const uiMessageRouter = createControllerUiMessageRouter({
    getCurrentPhase: () => options.controllerOptions.stateStore.snapshot().phase,
    handleCommandUiResponse: (requestId, payload, correlationId) =>
      flows.commandUiFlow.handleResponse(requestId, payload, correlationId),
    handleExtensionUiResponse: (requestId, payload) =>
      flows.processEventFlow.handleExtensionUiResponse(requestId, payload),
    handlePrompt: (text, images, correlationId) =>
      flows.runtimeFlow.handlePrompt(text, images, correlationId),
    handleRunCommand: (name, rawInput, correlationId) =>
      flows.commandRoutingFlow.run(name, rawInput, correlationId),
    onRpcQuery: (command, correlationId) => flows.rpcFlow.onRpcQuery(command, correlationId),
    onUiReady: (correlationId) => flows.rpcFlow.onUiReady(correlationId),
    runRuntimeCommand: (command, phase, correlationId) =>
      flows.runtimeFlow.runCommand(command, phase, correlationId),
  });

  return {
    ...flows,
    uiMessageRouter,
    unsubscribe,
  };
}

function createControllerFlowBundle(
  options: CreateSidebarControllerWiringOptions,
  extensionUiTimeoutMs: number,
): ControllerFlowBundle {
  const { rpcFlow, runtimeFlow } = createControllerRuntimeRpcBundle(options);
  const { commandRoutingFlow, commandUiFlow, directCommandFlow } = createControllerCommandBundle({
    options,
    rpcFlow,
    runtimeFlow,
  });
  const processEventFlow = createProcessEventFlow({
    emit: options.emit,
    emitState: () => runtimeFlow.emitState(),
    ensureStarted: () => options.controllerOptions.ensureStarted(),
    extensionUiTimeoutMs,
    logger: options.controllerOptions.logger,
    reportCommandFailure: (response) => {
      options.reportCommandFailure(response);
    },
    rpcClient: options.controllerOptions.rpcClient,
    stateStore: options.controllerOptions.stateStore,
    syncState: () => runtimeFlow.syncState(),
  });

  return {
    commandRoutingFlow,
    commandUiFlow,
    directCommandFlow,
    processEventFlow,
    rpcFlow,
    runtimeFlow,
  };
}

function createControllerRuntimeRpcBundle(
  options: CreateSidebarControllerWiringOptions,
): ControllerRuntimeRpcBundle {
  let rpcFlow!: ControllerRpcFlow;
  const runtimeFlow = createControllerRuntimeFlow({
    emit: options.emit,
    ensureStarted: () => options.controllerOptions.ensureStarted(),
    listRecentSessions: options.controllerOptions.listRecentSessions,
    onRpcState: options.controllerOptions.onRpcState,
    replayMessages: (correlationId, replace) => rpcFlow.replayMessages(correlationId, replace),
    reportCommandFailure: options.reportCommandFailure,
    rpcClient: options.controllerOptions.rpcClient,
    stateStore: options.controllerOptions.stateStore,
  });
  rpcFlow = createControllerRpcFlow({
    emit: options.emit,
    ensureStarted: () => options.controllerOptions.ensureStarted(),
    reportCommandFailure: options.reportCommandFailure,
    sendRpcCommand: (command, correlationId) => runtimeFlow.sendRpcCommand(command, correlationId),
    sendRpcRequest: (command, correlationId) => runtimeFlow.sendRpcRequest(command, correlationId),
    syncState: () => runtimeFlow.syncState(),
  });
  return { rpcFlow, runtimeFlow };
}

function createControllerCommandBundle(options: {
  options: CreateSidebarControllerWiringOptions;
  rpcFlow: ControllerRpcFlow;
  runtimeFlow: ControllerRuntimeFlow;
}): ControllerCommandBundle {
  const commandUiFlow = createCommandUiFlow({
    emitCommandError: options.options.emitCommandError,
    emitCommandUiRequest: options.options.emitCommandUiRequest,
    getCurrentPhase: () => options.options.controllerOptions.stateStore.snapshot().phase,
    listRecentSessions: options.options.controllerOptions.listRecentSessions,
    onSimpleCommand: (command, phase, correlationId) =>
      options.runtimeFlow.runCommand(command, phase, correlationId),
    reportCommandFailure: options.options.reportCommandFailure,
    sendRpcCommand: (command, correlationId) =>
      options.runtimeFlow.sendRpcCommand(command, correlationId),
  });
  const directCommandFlow = createDirectCommandFlow({
    emitCommandError: options.options.emitCommandError,
    emitCommandResult: options.options.emitCommandResult,
    executeIdleCommand: (command, correlationId) =>
      options.runtimeFlow.runCommand(command, "idle", correlationId),
    reportCommandFailure: options.options.reportCommandFailure,
    sendRpcCommand: (command, correlationId) =>
      options.runtimeFlow.sendRpcCommand(command, correlationId),
  });
  const commandRoutingFlow = createCommandRoutingFlow({
    commandUiFlow,
    directCommandFlow,
    emitCommandResult: options.options.emitCommandResult,
    rpcFlow: options.rpcFlow,
  });

  return { commandRoutingFlow, commandUiFlow, directCommandFlow };
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_EXTENSION_UI_TIMEOUT_MS;
  }
  return Math.max(1000, Math.trunc(timeoutMs));
}
