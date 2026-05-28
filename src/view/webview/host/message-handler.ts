import { z } from "zod";
import type { CommandPalette } from "../features/command/palette.ts";
import type { CommandUiController } from "../features/command/ui.ts";
import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";
import type { ImageAttachmentController } from "../features/image-attachments/controller.ts";
import type { ModelControls } from "../features/model/controls.ts";
import type { PromptReferenceEditor } from "../ui/prompt-reference-editor.ts";
import type { HostToUiMessage } from "../../protocol.ts";

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

const HostEventSchema = z.object({ type: z.string() }).catchall(z.unknown());
const ThinkingLevelChangedEventSchema = z
  .object({ type: z.literal("thinking_level_changed"), level: z.string() })
  .catchall(z.unknown());
const QueryResultEventSchema = z
  .object({ type: z.literal("query_result"), command: z.string() })
  .catchall(z.unknown());
const HostStatePayloadSchema = z
  .object({
    rpc: z.object({}).catchall(z.unknown()).optional(),
  })
  .catchall(z.unknown());

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
    const parsedEvent = HostEventSchema.safeParse(data);
    if (!parsedEvent.success) return;
    if (parsedEvent.data.type === "thinking_level_changed") {
      const thinkingLevelChanged = ThinkingLevelChangedEventSchema.safeParse(parsedEvent.data);
      if (!thinkingLevelChanged.success) return;
      options.modelControls.syncRpcState({ thinkingLevel: thinkingLevelChanged.data.level });
      return;
    }
    if (parsedEvent.data.type === "query_result") {
      const queryResult = QueryResultEventSchema.safeParse(parsedEvent.data);
      if (!queryResult.success) return;
      if (options.modelControls.handleQueryResult(queryResult.data)) return;
      options.conversationPage.applyEvent(queryResult.data);
      return;
    }
    options.conversationPage.applyEvent(parsedEvent.data);
  }

  function applyStateMessage(data: unknown): void {
    const parsedState = HostStatePayloadSchema.safeParse(data);
    if (!parsedState.success) return;
    options.modelControls.syncRpcState(parsedState.data.rpc);
    options.conversationPage.applyState(parsedState.data);
    options.modelControls.requestAvailableModels();
  }
}
