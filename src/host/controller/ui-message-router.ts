import type { RpcCommand, RpcImageContent } from "../../shared/rpc-types.ts";
import type { UiToHostMessage } from "../../view/protocol.ts";
import type { RpcSessionPhase } from "../state-store.ts";

interface ControllerUiMessageRouterOptions {
  getCurrentPhase(): RpcSessionPhase;
  handleCommandUiResponse(
    requestId: string,
    payload: unknown,
    correlationId: string | undefined,
  ): Promise<void>;
  handleExtensionUiResponse(requestId: string, payload: unknown): Promise<void>;
  handlePrompt(
    text: string,
    images: RpcImageContent[] | undefined,
    correlationId: string | undefined,
  ): Promise<void>;
  handleRunCommand(
    name: string,
    rawInput: string,
    correlationId: string | undefined,
  ): Promise<void>;
  onRpcQuery(command: RpcCommand, correlationId: string | undefined): Promise<void>;
  onUiReady(correlationId: string | undefined): Promise<void>;
  runRuntimeCommand(
    command: RpcCommand,
    phase: RpcSessionPhase,
    correlationId: string | undefined,
  ): Promise<void>;
}

export interface ControllerUiMessageRouter {
  handle(message: UiToHostMessage): Promise<void>;
}

export function createControllerUiMessageRouter(
  options: ControllerUiMessageRouterOptions,
): ControllerUiMessageRouter {
  return {
    async handle(message) {
      switch (message.type) {
        case "ui_ready":
          await options.onUiReady(message.correlationId);
          return;
        case "send_prompt":
          await options.handlePrompt(message.text, message.images, message.correlationId);
          return;
        case "run_command":
          await options.handleRunCommand(message.name, message.rawInput, message.correlationId);
          return;
        case "respond_command_ui":
          await options.handleCommandUiResponse(
            message.requestId,
            message.payload,
            message.correlationId,
          );
          return;
        case "abort":
          await options.runRuntimeCommand({ type: "abort" }, "idle", message.correlationId);
          return;
        case "new_session":
          await options.runRuntimeCommand({ type: "new_session" }, "idle", message.correlationId);
          return;
        case "switch_session":
          await options.runRuntimeCommand(
            { type: "switch_session", sessionPath: message.sessionPath },
            "idle",
            message.correlationId,
          );
          return;
        case "set_session_name":
          await options.runRuntimeCommand(
            { type: "set_session_name", name: message.name },
            "idle",
            message.correlationId,
          );
          return;
        case "export_html":
          await options.onRpcQuery(
            { type: "export_html", outputPath: message.outputPath },
            message.correlationId,
          );
          return;
        case "get_available_models":
          await options.onRpcQuery({ type: "get_available_models" }, message.correlationId);
          return;
        case "get_session_stats":
          await options.onRpcQuery({ type: "get_session_stats" }, message.correlationId);
          return;
        case "set_model":
          await options.runRuntimeCommand(
            { type: "set_model", provider: message.provider, modelId: message.modelId },
            options.getCurrentPhase(),
            message.correlationId,
          );
          return;
        case "set_thinking_level":
          await options.runRuntimeCommand(
            { type: "set_thinking_level", level: message.level },
            "idle",
            message.correlationId,
          );
          return;
        case "respond_extension_ui":
          await options.handleExtensionUiResponse(message.requestId, message.payload);
          return;
      }
    },
  };
}
