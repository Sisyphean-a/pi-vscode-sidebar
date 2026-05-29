import type { CommandPalette } from "../features/command/palette.ts";
import type { CommandUiController } from "../features/command/ui.ts";
import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";
import type { ImageAttachmentController } from "../features/image-attachments/controller.ts";
import type { ModelControls } from "../features/model/controls.ts";
import type { PromptReferenceEditor } from "../ui/prompt-reference-editor.ts";
import type { HostToUiMessage } from "../../protocol.ts";
import { decodeHostEventPayload, decodeHostStatePayload } from "./message-decoder.ts";

interface CreateHostMessageHandlerOptions {
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
  conversationPage: ConversationPageFlow;
  imageAttachmentController: ImageAttachmentController;
  modelControls: ModelControls;
  promptReferenceEditor: PromptReferenceEditor;
  renderExtensionUiRequest(data: Record<string, unknown>): void;
}

export interface HostMessageHandler {
  handle(message: HostToUiMessage): void;
}

export function createHostMessageHandler(
  options: CreateHostMessageHandlerOptions,
): HostMessageHandler {
  return {
    handle(message) {
      if (message.type === "notice") return;
      if (message.type === "error") {
        options.modelControls.handleHostError();
        options.conversationPage.appendTransientMessage("error", message.message);
        return;
      }
      if (message.type === "event") {
        applyHostEvent(message.data);
        return;
      }
      if (message.type === "insert_prompt_reference") {
        options.promptReferenceEditor.insert(message.data);
        return;
      }
      if (message.type === "image_attachments_added") {
        options.imageAttachmentController.applyAdded(message.data);
        return;
      }
      if (message.type === "state") {
        applyStateMessage(message.data);
        return;
      }
      if (message.type === "command_ui_request") {
        options.commandPalette.hide();
        options.commandUi.renderRequest(message.data);
        return;
      }
      if (message.type === "command_result") {
        void options.commandUi.applyResult(message.data);
        return;
      }
      if (message.type === "extension_ui_request") {
        options.renderExtensionUiRequest(message.data);
        options.conversationPage.syncRecentSessionsVisibility();
      }
    },
  };

  function applyHostEvent(data: unknown): void {
    const event = decodeHostEventPayload(data);
    if (!event) {
      throw new Error("Invalid host event payload.");
    }
    if (event.kind === "thinking_level_changed") {
      options.modelControls.syncRpcState({ thinkingLevel: event.level });
      return;
    }
    if (event.kind === "query_result") {
      if (options.modelControls.handleQueryResult(event.event)) return;
      options.conversationPage.applyEvent(event.event);
      return;
    }
    options.conversationPage.applyEvent(event.event);
  }

  function applyStateMessage(data: unknown): void {
    const state = decodeHostStatePayload(data);
    if (!state) {
      throw new Error("Invalid host state payload.");
    }
    options.modelControls.syncRpcState(state.rpc);
    options.conversationPage.applyState(state.state);
    options.modelControls.requestAvailableModels();
  }
}
