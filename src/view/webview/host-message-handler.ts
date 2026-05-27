import type { CommandPalette } from "./command-palette.ts";
import type { CommandUiController } from "./command-ui.ts";
import type { ConversationPageFlow } from "./conversation-page-flow.ts";
import type { ImageAttachmentController } from "./image-attachments.ts";
import type { ModelControls } from "./model-controls.ts";
import type { PromptReferenceEditor } from "./prompt-reference-editor.ts";
import { asRecord, readString } from "./ui-text.ts";
import type { HostToUiMessage } from "../protocol.ts";

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
        applyStateMessage(message.data as Record<string, unknown>);
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
        options.renderExtensionUiRequest(message.data as Record<string, unknown>);
        options.conversationPage.syncRecentSessionsVisibility();
      }
    },
  };

  function applyHostEvent(data: unknown): void {
    const event = asRecord(data);
    const type = readString(event?.type);
    if (!event || !type) return;
    if (type === "thinking_level_changed") {
      options.modelControls.syncRpcState({ thinkingLevel: event.level });
      return;
    }
    if (options.modelControls.handleQueryResult(event)) return;
    options.conversationPage.applyEvent(event);
  }

  function applyStateMessage(data: Record<string, unknown>): void {
    options.modelControls.syncRpcState(asRecord(data.rpc));
    options.conversationPage.applyState(data);
    options.modelControls.requestAvailableModels();
  }
}
