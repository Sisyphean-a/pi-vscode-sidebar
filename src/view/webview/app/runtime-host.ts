import type { AppDom } from "./shell.tsx";
import type { CommandPalette } from "../features/command/palette.ts";
import type { CommandUiController } from "../features/command/ui.ts";
import { syncComposerHeight } from "../features/composer/composer.ts";
import type { ConversationPageFlow } from "../features/conversation/page-flow.ts";
import { createExtensionUiRenderer } from "../features/extension-ui/panel.tsx";
import { createHostMessageHandler, type HostMessageHandler } from "../host/message-handler.ts";
import type { ImageAttachmentController } from "../features/image-attachments/controller.ts";
import type { ModelControls } from "../features/model/controls.ts";
import { createPromptReferenceEditor } from "../ui/prompt-reference-editor.ts";
import type { UiMessagePoster } from "../host/ui-message-poster.ts";

interface CreateSidebarHostBridgeOptions {
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
  conversationPage: ConversationPageFlow;
  dom: AppDom;
  imageAttachmentController: ImageAttachmentController;
  modelControls: ModelControls;
  uiMessagePoster: UiMessagePoster;
}

export function createSidebarHostBridge(
  options: CreateSidebarHostBridgeOptions,
): HostMessageHandler {
  const promptReferenceEditor = createPromptReferenceEditor({
    promptInput: options.dom.promptInput,
    syncComposerHeight,
  });
  const renderExtensionUiRequest = createExtensionUiRenderer({
    panel: options.dom.extensionUiPanel,
    postResponse(requestId, payload) {
      options.uiMessagePoster.post({ type: "respond_extension_ui", requestId, payload });
    },
    queueNotice(message) {
      options.conversationPage.appendInlineNote(message);
    },
    setEditorText(text) {
      options.dom.promptInput.value = text;
      options.dom.promptInput.focus();
    },
    updateStatus() {},
    updateTitle() {},
  });

  return createHostMessageHandler({
    commandPalette: options.commandPalette,
    commandUi: options.commandUi,
    conversationPage: options.conversationPage,
    imageAttachmentController: options.imageAttachmentController,
    modelControls: options.modelControls,
    promptReferenceEditor,
    renderExtensionUiRequest,
  });
}
