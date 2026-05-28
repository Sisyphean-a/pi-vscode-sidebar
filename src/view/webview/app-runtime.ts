import { resolveSidebarLocale } from "../../shared/sidebar-commands.ts";
import { bindAppEventBindings } from "./app-event-bindings.ts";
import { createAppDom } from "./app-shell.tsx";
import { createSidebarAppRuntime as buildSidebarAppRuntime } from "./app-runtime-builders.ts";
import { syncComposerHeight } from "./composer.ts";
import { createUiMessagePoster } from "./ui-message-poster.ts";

interface VsCodeApi {
  postMessage(message: object): void;
}

interface InitializeSidebarAppOptions {
  root: HTMLElement;
  vscode: VsCodeApi;
}

export function initializeSidebarApp(options: InitializeSidebarAppOptions): void {
  const dom = createAppDom(options.root);
  const locale = resolveSidebarLocale(document.documentElement.lang);
  const uiMessagePoster = createUiMessagePoster(options.vscode);
  const runtime = buildSidebarAppRuntime({ dom, locale, uiMessagePoster });

  bindAppEventBindings({
    commandPalette: runtime.commandPalette,
    commandUi: runtime.commandUi,
    composerActions: runtime.composerActions,
    getIsStreamingPhase() {
      return runtime.appLifecycle.isStreamingPhase();
    },
    handleHostMessage(message) {
      runtime.hostMessageHandler.handle(message);
    },
    handleMessageFeedClick(event) {
      runtime.conversationPage.handleMessageFeedClick(event);
    },
    handleMessageFeedScroll() {
      runtime.conversationPage.handleMessageFeedScroll();
    },
    handlePromptPaste(event) {
      return runtime.imageAttachmentController.handlePaste(event);
    },
    handleScrollToBottom() {
      runtime.conversationPage.scrollToBottom(true);
    },
    messageFeed: dom.messageFeed,
    newSessionButton: dom.newSessionButton,
    onAbort() {
      uiMessagePoster.post({ type: "abort" });
    },
    onNewSession() {
      runtime.appLifecycle.startFreshConversation();
      uiMessagePoster.post({ type: "new_session" });
    },
    promptInput: dom.promptInput,
    scrollToBottomButton: dom.scrollToBottomButton,
    sendButton: dom.sendButton,
    syncComposerHeight,
  });

  uiMessagePoster.post({ type: "ui_ready" });
  runtime.modelControls.requestAvailableModels();
}
