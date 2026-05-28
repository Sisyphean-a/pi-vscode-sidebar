import type { RpcClient } from "../rpc-client.ts";
import type { RpcSessionStateStore } from "../state-store.ts";
import {
  buildRuntimeQueryResultEvent,
  buildRuntimeStateMessage,
  shouldEmitRuntimeQueryResult,
  shouldReplayRuntimeMessages,
  withRuntimeCommandId,
} from "./flow-support.ts";
import type { HostToUiMessage } from "../../view/protocol.ts";
import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import type { RpcCommand, RpcImageContent, RpcSessionState } from "../../shared/rpc-types.ts";

type ControllerPhase = "idle" | "streaming" | "awaiting_extension_ui" | "process_dead";

interface RpcResponseLike {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface CreateControllerRuntimeFlowOptions {
  emit(message: HostToUiMessage): void;
  ensureStarted(): Promise<void>;
  listRecentSessions?(): Promise<RecentSessionSummary[]>;
  onRpcState?(state: RpcSessionState): Promise<void> | void;
  replayMessages(correlationId: string | undefined, replace: boolean): Promise<void>;
  reportCommandFailure(
    response: { success: boolean; error?: string },
    correlationId?: string,
  ): void;
  rpcClient: RpcClient;
  stateStore: RpcSessionStateStore;
}

export interface ControllerRuntimeFlow {
  emitState(): void;
  handlePrompt(
    text: string,
    images: RpcImageContent[] | undefined,
    correlationId: string | undefined,
  ): Promise<void>;
  runCommand(
    command: RpcCommand,
    phase: ControllerPhase,
    correlationId: string | undefined,
  ): Promise<void>;
  sendRpcCommand(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
  sendRpcRequest(command: RpcCommand, correlationId: string | undefined): Promise<RpcResponseLike>;
  syncState(): Promise<void>;
}

export function createControllerRuntimeFlow(
  options: CreateControllerRuntimeFlowOptions,
): ControllerRuntimeFlow {
  return {
    emitState() {
      options.emit(buildRuntimeStateMessage(options.stateStore.snapshot()));
    },
    async handlePrompt(text, images, correlationId) {
      const phase = options.stateStore.snapshot().phase;
      if (phase !== "idle") {
        options.emit({
          type: "error",
          scope: "ui",
          message: `Cannot send prompt while phase is "${phase}".`,
        });
        return;
      }

      await options.ensureStarted();
      options.stateStore.markStreaming();
      this.emitState();
      const response = await this.sendRpcRequest(
        { type: "prompt", message: text, images },
        correlationId,
      );
      if (!response.success) {
        options.stateStore.markIdle();
        this.emitState();
      }
      options.reportCommandFailure(response, correlationId);
    },
    async runCommand(command, phase, correlationId) {
      await options.ensureStarted();
      if (phase === "idle") options.stateStore.markIdle();
      const response = await this.sendRpcRequest(command, correlationId);
      options.reportCommandFailure(response, correlationId);
      await this.syncState();
      if (response.success && shouldEmitRuntimeQueryResult(command.type)) {
        options.emit(buildRuntimeQueryResultEvent(command.type, response.data, correlationId));
      }
      if (shouldReplayRuntimeMessages(command.type)) {
        await options.replayMessages(correlationId, true);
      }
    },
    async sendRpcCommand(command, correlationId) {
      await options.ensureStarted();
      return this.sendRpcRequest(command, correlationId);
    },
    async sendRpcRequest(command, correlationId) {
      return options.rpcClient.send(withRuntimeCommandId(command, correlationId));
    },
    async syncState() {
      const rpcState = await options.rpcClient.getState().catch(() => undefined);
      if (rpcState) await options.onRpcState?.(rpcState);
      const recentSessions = await options.listRecentSessions?.();
      options.emit(
        buildRuntimeStateMessage(options.stateStore.snapshot(), rpcState, recentSessions),
      );
    },
  };
}
