import type {
  SidebarCommandDefinition,
  SidebarCommandLocale,
} from "../../../shared/sidebar-commands.ts";
import { resolveSidebarCommandId } from "../../../shared/sidebar-commands.ts";
import { createActivityController } from "../features/activity/controller.ts";
import { createAppLifecycle, type AppLifecycle } from "./lifecycle.ts";
import { bindAppEventBindings } from "./event-bindings.ts";
import { createCommandPalette, type CommandPalette } from "../features/command/palette.ts";
import {
  createCommandUiController,
  type CommandUiController,
} from "../features/command/ui.ts";
import { createComposerActions, type ComposerActions } from "../features/composer/actions.ts";
import { createConversationFeed } from "../features/conversation/feed.ts";
import { createConversationPageFlow, type ConversationPageFlow } from "../features/conversation/page-flow.ts";
import {
  createExtensionUiRenderer,
  type ExtensionUiController,
} from "../features/extension-ui/panel.tsx";
import {
  createImageAttachmentController,
  type ImageAttachmentController,
} from "../features/image-attachments/controller.ts";
import { renderAssistantMarkdown, renderPlainTextWithReferences } from "../features/markdown/markdown.ts";
import { createModelControls, type ModelControls } from "../features/model/controls.ts";
import { createRecentSessionsPanel } from "../features/recent-sessions/panel.ts";
import { createSidebarHostBridge } from "./runtime-host.ts";
import type { HostMessageHandler } from "../host/message-handler.ts";
import type { UiMessagePoster } from "../host/ui-message-poster.ts";
import type {
  DisabledPort,
  RuntimeViewPorts,
  SendButtonStreamingPort,
} from "./view-ports.ts";

export interface SidebarAppRuntime {
  appLifecycle: AppLifecycle;
  bindEvents(options: RuntimeEventBindingOptions): void;
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
  composerActions: ComposerActions;
  conversationPage: ConversationPageFlow;
  hostMessageHandler: HostMessageHandler;
  imageAttachmentController: ImageAttachmentController;
  modelControls: ModelControls;
}

interface RuntimeEventBindingOptions {
  onAbort(): void;
  onNewSession(): void;
}

interface CreateSidebarAppRuntimeOptions {
  locale: SidebarCommandLocale;
  uiMessagePoster: UiMessagePoster;
  viewPorts: RuntimeViewPorts;
}

interface RuntimeBuilderContext extends CreateSidebarAppRuntimeOptions {
  dynamicSlashCommands: SidebarCommandDefinition[];
  appLifecycle?: AppLifecycle;
  conversationPage?: ConversationPageFlow;
}

type ConversationRuntimeOptions = {
  commandPalette: CommandPalette;
  context: RuntimeBuilderContext;
  extensionUi: Pick<ExtensionUiController, "hide" | "isVisible">;
};

export function createSidebarAppRuntime(
  options: CreateSidebarAppRuntimeOptions,
): SidebarAppRuntime {
  const context: RuntimeBuilderContext = {
    ...options,
    dynamicSlashCommands: [],
  };
  const { commandPalette, commandUi } = createCommandSurface(context);
  const extensionUiController = createSidebarExtensionUiController(context, (message) => {
    context.conversationPage?.appendInlineNote(message);
  });

  const conversationPage = createConversationRuntime({
    commandPalette,
    context,
    extensionUi: extensionUiController,
  });
  context.conversationPage = conversationPage;

  const imageAttachmentController = createSidebarImageAttachments(context, conversationPage);
  const modelControls = createSidebarModelControls(
    context,
    conversationPage,
    imageAttachmentController,
  );
  const composerActions = createSidebarComposerActions(
    context,
    commandPalette,
    conversationPage,
    imageAttachmentController,
  );

  const composerInput = context.viewPorts.composer.input;

  context.appLifecycle = createAppLifecycle({
    conversationPage,
    resetComposer() {
      composerInput.setValue("");
      imageAttachmentController.clear();
      composerInput.resetHeight();
    },
    syncStreamingChrome(isStreamingPhase) {
      syncStreamingChromeControls(
        context.viewPorts.header.newSessionButtonDisabled,
        context.viewPorts.composer.sendButtonStreaming,
        isStreamingPhase,
      );
    },
  });
  composerInput.resetHeight();

  const hostMessageHandler = createSidebarHostBridge({
    commandPalette,
    commandUi,
    conversationPage,
    imageAttachmentController,
    modelControls,
    promptInput: composerInput,
    renderExtensionUiRequest(data) {
      extensionUiController.handleRequest(data);
    },
  });

  const runtimeLifecycle = requireAppLifecycle(context);

  return {
    appLifecycle: runtimeLifecycle,
    bindEvents(eventBindingOptions) {
      bindAppEventBindings({
        composerInput,
        commandPalette,
        commandUi,
        composerActions,
        getIsStreamingPhase: runtimeLifecycle.isStreamingPhase,
        handleHostMessage: hostMessageHandler.handle,
        handleMessageFeedClick: conversationPage.handleMessageFeedClick,
        handleMessageFeedScroll: conversationPage.handleMessageFeedScroll,
        handlePromptPaste(event) {
          return imageAttachmentController.handlePaste(event);
        },
        handleScrollToBottom() {
          conversationPage.scrollToBottom(true);
        },
        messageFeed: context.viewPorts.conversation.eventPort,
        newSessionButton: context.viewPorts.header.newSessionButtonClick,
        onAbort: eventBindingOptions.onAbort,
        onNewSession() {
          runtimeLifecycle.startFreshConversation();
          eventBindingOptions.onNewSession();
        },
        scrollToBottomButton: context.viewPorts.conversation.scrollToBottomButtonClick,
        sendButton: context.viewPorts.composer.sendButtonClick,
      });
    },
    commandPalette,
    commandUi,
    composerActions,
    conversationPage,
    hostMessageHandler,
    imageAttachmentController,
    modelControls,
  };
}

function requireAppLifecycle(context: Pick<RuntimeBuilderContext, "appLifecycle">): AppLifecycle {
  if (!context.appLifecycle) {
    throw new Error("App lifecycle is not initialized.");
  }
  return context.appLifecycle;
}

function createSidebarExtensionUiController(
  context: RuntimeBuilderContext,
  onInlineNote: (message: string) => void,
): ExtensionUiController {
  const composerInput = context.viewPorts.composer.input;
  return createExtensionUiRenderer({
    panelVisibility: context.viewPorts.conversation.extensionUiPanelVisibility,
    view: context.viewPorts.conversation.extensionUiPanelView,
    postResponse(requestId, payload) {
      context.uiMessagePoster.post({ type: "respond_extension_ui", requestId, payload });
    },
    queueNotice: onInlineNote,
    setEditorText(text) {
      composerInput.setValue(text);
      composerInput.focus();
    },
    updateStatus() {},
    updateTitle() {},
  });
}

function createCommandSurface(context: RuntimeBuilderContext): {
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
} {
  const composerInput = context.viewPorts.composer.input;
  let commandPalette!: CommandPalette;
  commandPalette = createCommandPalette({
    applyCommand(name) {
      composerInput.setValueAndSyncHeight(`/${name}`);
      composerInput.focus();
      commandPalette.update(composerInput.getValue());
    },
    locale: context.locale,
    view: context.viewPorts.composer.commandPaletteView,
  });

  const commandUi = createCommandUiController({
    focusComposer() {
      composerInput.focus();
    },
    result: context.viewPorts.composer.commandResult,
    view: context.viewPorts.composer.commandUiView,
    postResponse(requestId, payload) {
      context.uiMessagePoster.post({ type: "respond_command_ui", requestId, payload });
    },
    setComposerValue(value) {
      composerInput.setValueAndSyncHeight(value);
    },
  });

  return { commandPalette, commandUi };
}

function createConversationRuntime(options: ConversationRuntimeOptions): ConversationPageFlow {
  const composerInput = options.context.viewPorts.composer.input;
  const recentSessionsPanel = createRecentSessionsPanel({
    onSelect(sessionPath) {
      requireAppLifecycle(options.context).beginConversationReplay();
      options.context.uiMessagePoster.post({ type: "switch_session", sessionPath });
    },
    overlayView: options.context.viewPorts.header.recentSessionsOverlayView,
    sectionView: options.context.viewPorts.header.recentSessionsSectionView,
  });
  const conversationFeed = createConversationFeed({
    view: options.context.viewPorts.conversation.messageFeedView,
    onChange() {
      options.context.conversationPage?.handleContentChange();
    },
    renderAssistantMarkdown,
    renderPlainTextWithReferences,
  });
  const activityController = createActivityController({
    view: options.context.viewPorts.conversation.activityFeedView,
    conversationFeed,
    onChange() {
      options.context.conversationPage?.handleContentChange();
    },
    resolveView() {
      return conversationFeed.findInlineActivitySlotView();
    },
  });
  const conversationPage = createConversationPageFlow({
    activityController,
    conversationFeed,
    isExtensionUiVisible() {
      return options.extensionUi.isVisible();
    },
    onDynamicCommandsChange(commands) {
      options.context.dynamicSlashCommands = [...commands];
      options.commandPalette.setDynamicCommands(commands);
      options.commandPalette.update(composerInput.getValue());
    },
    onOpenFileReference(path, startLine, endLine) {
      options.context.uiMessagePoster.post({
        type: "open_file_reference",
        path,
        startLine,
        endLine,
      });
    },
    onStreamingPhaseChange(isStreaming) {
      requireAppLifecycle(options.context).setStreamingPhase(isStreaming);
    },
    recentSessionsPanel,
    resetExtensionUi() {
      options.extensionUi.hide();
    },
    setScrollToBottomVisible(visible) {
      options.context.viewPorts.conversation.scrollToBottomVisibility.setHidden(!visible);
    },
    viewport: options.context.viewPorts.conversation.viewport,
  });
  return conversationPage;
}

function createSidebarImageAttachments(
  context: RuntimeBuilderContext,
  conversationPage: ConversationPageFlow,
): ImageAttachmentController {
  return createImageAttachmentController({
    button: context.viewPorts.composer.imageAttachmentButton,
    listView: context.viewPorts.composer.imageAttachmentListView,
    onRequestPick() {
      context.uiMessagePoster.post({ type: "pick_image_attachments" });
    },
    onStorePastedImage({ dataUrl, mimeType, name }) {
      context.uiMessagePoster.post({
        type: "store_pasted_image_attachment",
        dataUrl,
        mimeType,
        name,
      });
    },
    onUnsupportedInput() {
      conversationPage.appendTransientMessage("error", "当前模型不支持图片输入");
    },
  });
}

function createSidebarModelControls(
  context: RuntimeBuilderContext,
  conversationPage: ConversationPageFlow,
  imageAttachmentController: ImageAttachmentController,
): ModelControls {
  return createModelControls({
    createPickerControls(handlers) {
      return context.viewPorts.composer.modelPickerControlsFactory.create(handlers);
    },
    onImageSupportChange(supported) {
      imageAttachmentController.setSupported(supported);
    },
    onInlineNote(message) {
      conversationPage.appendInlineNote(message);
    },
    onRequestAvailableModels() {
      context.uiMessagePoster.post({ type: "get_available_models" });
    },
    onRequestModelChange(provider, modelId) {
      context.uiMessagePoster.post({ type: "set_model", provider, modelId });
    },
    onRequestThinkingLevelChange(level) {
      context.uiMessagePoster.post({ type: "set_thinking_level", level });
    },
  });
}

function createSidebarComposerActions(
  context: RuntimeBuilderContext,
  commandPalette: CommandPalette,
  conversationPage: ConversationPageFlow,
  imageAttachmentController: ImageAttachmentController,
): ComposerActions {
  return createComposerActions({
    commandPalette,
    imageAttachmentController,
    onAppendLocalUserPrompt(text, attachments) {
      conversationPage.appendLocalUserPrompt(text, attachments);
    },
    onPostRunCommand(name, rawInput) {
      context.uiMessagePoster.post({ type: "run_command", name, rawInput });
    },
    onPostSendPrompt(text, images) {
      context.uiMessagePoster.post({ type: "send_prompt", text, images });
    },
    onUnsupportedImageInput() {
      conversationPage.appendTransientMessage("error", "当前模型不支持图片输入");
    },
    composerInput: context.viewPorts.composer.input,
    resolveCommandName(rawInput) {
      return resolveSidebarCommandId(
        rawInput,
        context.locale,
        context.dynamicSlashCommands,
      );
    },
  });
}

function syncStreamingChromeControls(
  newSessionButton: DisabledPort,
  sendButton: SendButtonStreamingPort,
  isStreamingPhase: boolean,
): void {
  newSessionButton.setDisabled(isStreamingPhase);
  sendButton.setStreaming(isStreamingPhase);
}
