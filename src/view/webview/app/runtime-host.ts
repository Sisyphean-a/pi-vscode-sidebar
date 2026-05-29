import type { CommandPalette } from "../features/command/palette.ts";
import type { CommandUiController } from "../features/command/ui.ts";
import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";
import { createHostMessageHandler, type HostMessageHandler } from "../host/message-handler.ts";
import type { ImageAttachmentController } from "../features/image-attachments/controller.ts";
import type { ModelControls } from "../features/model/controls.ts";
import {
  createPromptReferenceEditor,
  type PromptReferenceInput,
} from "../ui/prompt-reference-editor.ts";

interface CreateSidebarHostBridgeOptions {
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
  conversationPage: ConversationPageFlow;
  imageAttachmentController: ImageAttachmentController;
  modelControls: ModelControls;
  promptInput: PromptReferenceInput;
  renderExtensionUiRequest(data: Record<string, unknown>): void;
}

export function createSidebarHostBridge(
  options: CreateSidebarHostBridgeOptions,
): HostMessageHandler {
  const promptReferenceEditor = createPromptReferenceEditor({ promptInput: options.promptInput });

  return createHostMessageHandler({
    commandPalette: options.commandPalette,
    commandUi: options.commandUi,
    conversationPage: options.conversationPage,
    imageAttachmentController: options.imageAttachmentController,
    modelControls: options.modelControls,
    promptReferenceEditor,
    renderExtensionUiRequest: options.renderExtensionUiRequest,
  });
}
