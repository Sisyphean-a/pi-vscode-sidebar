import { type AppDom, expectAppElement } from "./app-dom.ts";
import type { CommandPalette } from "./command-palette.ts";
import type { CommandUiController } from "./command-ui.ts";
import { syncComposerHeight } from "./composer.ts";
import type { ConversationPageFlow } from "./conversation-page-flow.ts";
import { createExtensionUiRenderer } from "./extension-ui.ts";
import { createHostMessageHandler, type HostMessageHandler } from "./host-message-handler.ts";
import type { ImageAttachmentController } from "./image-attachments.ts";
import type { ModelControls } from "./model-controls.ts";
import { createPromptReferenceEditor } from "./prompt-reference-editor.ts";
import type { UiMessagePoster } from "./ui-message-poster.ts";

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
    escapeHtml(text) {
      return text;
    },
    expectElement(id) {
      return expectAppElement(options.dom.root, id);
    },
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
