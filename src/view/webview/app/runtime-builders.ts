import type {
  SidebarCommandDefinition,
  SidebarCommandLocale,
} from "../../../shared/sidebar-commands.ts";
import { resolveSidebarCommandId } from "../../../shared/sidebar-commands.ts";
import { createActivityController } from "../features/activity/controller.ts";
import { createAppLifecycle, type AppLifecycle } from "./lifecycle.ts";
import { type AppDom, expectAppElement } from "./shell.tsx";
import { createCommandPalette, type CommandPalette } from "../features/command/palette.ts";
import { createCommandUiController, type CommandUiController } from "../features/command/ui.ts";
import { createComposerActions, type ComposerActions } from "../features/composer/actions.ts";
import { resetComposerHeight, syncComposerHeight } from "../features/composer/composer.ts";
import { createConversationFeed } from "../features/conversation/feed.ts";
import { createConversationPageFlow, type ConversationPageFlow } from "../features/conversation/page-flow.ts";
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

export interface RuntimeRefs {
  appLifecycle?: AppLifecycle;
  conversationPage?: ConversationPageFlow;
  dynamicSlashCommands: SidebarCommandDefinition[];
}

export interface SidebarAppRuntime {
  appLifecycle: AppLifecycle;
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
  composerActions: ComposerActions;
  conversationPage: ConversationPageFlow;
  hostMessageHandler: HostMessageHandler;
  imageAttachmentController: ImageAttachmentController;
  modelControls: ModelControls;
}

interface CreateSidebarAppRuntimeOptions {
  dom: AppDom;
  locale: SidebarCommandLocale;
  uiMessagePoster: UiMessagePoster;
}

interface RuntimeBuilderContext extends CreateSidebarAppRuntimeOptions {
  refs: RuntimeRefs;
}

type ConversationRuntimeOptions = {
  commandPalette: CommandPalette;
  context: RuntimeBuilderContext;
};

type ConversationFeatureOptions = {
  context: RuntimeBuilderContext;
  conversationPage: ConversationPageFlow;
};

type ModelControlBuilderOptions = ConversationFeatureOptions & {
  imageAttachmentController: ImageAttachmentController;
};

type ComposerActionBuilderOptions = ModelControlBuilderOptions & {
  commandPalette: CommandPalette;
};

export function createSidebarAppRuntime(
  options: CreateSidebarAppRuntimeOptions,
): SidebarAppRuntime {
  const refs: RuntimeRefs = { dynamicSlashCommands: [] };
  const context: RuntimeBuilderContext = { ...options, refs };
  const { commandPalette, commandUi } = createCommandSurface(context);
  const conversationPage = createConversationRuntime({ commandPalette, context });
  const imageAttachmentController = createSidebarImageAttachments({ context, conversationPage });
  const modelControls = createSidebarModelControls({
    context,
    conversationPage,
    imageAttachmentController,
  });
  const composerActions = createSidebarComposerActions({
    commandPalette,
    context,
    conversationPage,
    imageAttachmentController,
  });

  refs.appLifecycle = createAppLifecycle({
    conversationPage,
    imageAttachmentController,
    newSessionButton: context.dom.newSessionButton,
    promptInput: context.dom.promptInput,
    resetComposerHeight,
    sendButton: context.dom.sendButton,
  });
  resetComposerHeight(context.dom.promptInput);
  const hostMessageHandler = createSidebarHostBridge({
    commandPalette,
    commandUi,
    conversationPage,
    dom: context.dom,
    imageAttachmentController,
    modelControls,
    uiMessagePoster: context.uiMessagePoster,
  });

  return {
    appLifecycle: requireAppLifecycle(refs),
    commandPalette,
    commandUi,
    composerActions,
    conversationPage,
    hostMessageHandler,
    imageAttachmentController,
    modelControls,
  };
}

function createCommandSurface(context: RuntimeBuilderContext): {
  commandPalette: CommandPalette;
  commandUi: CommandUiController;
} {
  let commandPalette!: CommandPalette;
  commandPalette = createCommandPalette({
    applyCommand(name) {
      context.dom.promptInput.value = `/${name}`;
      syncComposerHeight(context.dom.promptInput);
      context.dom.promptInput.focus();
      commandPalette.update(context.dom.promptInput.value);
    },
    locale: context.locale,
    list: context.dom.commandPaletteList,
    panel: context.dom.commandPalettePanel,
  });

  const commandUi = createCommandUiController({
    focusComposer() {
      context.dom.promptInput.focus();
    },
    list: context.dom.commandUiList,
    panel: context.dom.commandUiPanel,
    postResponse(requestId, payload) {
      context.uiMessagePoster.post({ type: "respond_command_ui", requestId, payload });
    },
    result: context.dom.commandResult,
    setComposerValue(value) {
      context.dom.promptInput.value = value;
      syncComposerHeight(context.dom.promptInput);
    },
  });

  return { commandPalette, commandUi };
}

function createConversationRuntime(options: ConversationRuntimeOptions): ConversationPageFlow {
  const recentSessionsPanel = createRecentSessionsPanel({
    closeButton: options.context.dom.recentSessionsDialogClose,
    dialogList: options.context.dom.recentSessionsDialogList,
    dialogTitle: options.context.dom.recentSessionsDialogTitle,
    moreButton: options.context.dom.recentSessionsMoreButton,
    onSelect(sessionPath) {
      requireAppLifecycle(options.context.refs).beginConversationReplay();
      options.context.uiMessagePoster.post({ type: "switch_session", sessionPath });
    },
    overlay: options.context.dom.recentSessionsOverlay,
    preview: options.context.dom.recentSessionsPreview,
    section: options.context.dom.recentSessionsSection,
  });
  const conversationFeed = createConversationFeed({
    container: options.context.dom.messageFeed,
    onChange() {
      options.context.refs.conversationPage?.handleContentChange();
    },
    renderAssistantMarkdown,
    renderPlainTextWithReferences,
  });
  const activityController = createActivityController({
    container: options.context.dom.messageFeed,
    conversationFeed,
    onChange() {
      options.context.refs.conversationPage?.handleContentChange();
    },
  });
  const conversationPage = createConversationPageFlow({
    activityController,
    conversationFeed,
    extensionUiPanel: options.context.dom.extensionUiPanel,
    messageFeed: options.context.dom.messageFeed,
    onDynamicCommandsChange(commands) {
      options.context.refs.dynamicSlashCommands = commands;
      options.commandPalette.setDynamicCommands(commands);
      options.commandPalette.update(options.context.dom.promptInput.value);
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
      requireAppLifecycle(options.context.refs).setStreamingPhase(isStreaming);
    },
    recentSessionsPanel,
    scrollToBottomButton: options.context.dom.scrollToBottomButton,
  });
  options.context.refs.conversationPage = conversationPage;
  return conversationPage;
}

function createSidebarImageAttachments(
  options: ConversationFeatureOptions,
): ImageAttachmentController {
  return createImageAttachmentController({
    button: options.context.dom.imageAttachmentButton,
    list: options.context.dom.imageAttachmentList,
    onRequestPick() {
      options.context.uiMessagePoster.post({ type: "pick_image_attachments" });
    },
    onStorePastedImage({ dataUrl, mimeType, name }) {
      options.context.uiMessagePoster.post({
        type: "store_pasted_image_attachment",
        dataUrl,
        mimeType,
        name,
      });
    },
    onUnsupportedInput() {
      options.conversationPage.appendTransientMessage("error", "当前模型不支持图片输入");
    },
  });
}

function createSidebarModelControls(options: ModelControlBuilderOptions): ModelControls {
  return createModelControls({
    expectElement(id) {
      return expectAppElement(options.context.dom.root, id);
    },
    onImageSupportChange(supported) {
      options.imageAttachmentController.setSupported(supported);
    },
    onInlineNote(message) {
      options.conversationPage.appendInlineNote(message);
    },
    onRequestAvailableModels() {
      options.context.uiMessagePoster.post({ type: "get_available_models" });
    },
    onRequestModelChange(provider, modelId) {
      options.context.uiMessagePoster.post({ type: "set_model", provider, modelId });
    },
    onRequestThinkingLevelChange(level) {
      options.context.uiMessagePoster.post({ type: "set_thinking_level", level });
    },
  });
}

function createSidebarComposerActions(options: ComposerActionBuilderOptions): ComposerActions {
  return createComposerActions({
    commandPalette: options.commandPalette,
    imageAttachmentController: options.imageAttachmentController,
    onAppendLocalUserPrompt(text, attachments) {
      options.conversationPage.appendLocalUserPrompt(text, attachments);
    },
    onPostRunCommand(name, rawInput) {
      options.context.uiMessagePoster.post({ type: "run_command", name, rawInput });
    },
    onPostSendPrompt(text, images) {
      options.context.uiMessagePoster.post({ type: "send_prompt", text, images });
    },
    onUnsupportedImageInput() {
      options.conversationPage.appendTransientMessage("error", "当前模型不支持图片输入");
    },
    promptInput: options.context.dom.promptInput,
    resetComposerHeight,
    resolveCommandName(rawInput) {
      return resolveSidebarCommandId(
        rawInput,
        options.context.locale,
        options.context.refs.dynamicSlashCommands,
      );
    },
  });
}

function requireAppLifecycle(refs: RuntimeRefs): AppLifecycle {
  if (!refs.appLifecycle) {
    throw new Error("App lifecycle is not initialized.");
  }
  return refs.appLifecycle;
}
