import type { SidebarCommandDefinition } from "../../../../shared/sidebar-commands.ts";
import type { UiPendingImageAttachment } from "../../../protocol.ts";
import type { ActivityController } from "../activity/controller.ts";
import { dispatchConversationPageEvent } from "./page-event-dispatch.ts";
import {
  applyConversationPageStateMessage,
  applyConversationReplayQueryResult,
} from "./page-effects.ts";
import { resolveConversationPageEvent } from "./page-events.ts";
import {
  beginConversationReplay as beginConversationReplayState,
  createConversationPageState,
  nextLocalMessageKey,
  resetConversationViewState,
  shouldScrollToBottom,
  shouldShowScrollToBottomButton,
  startFreshConversation as startFreshConversationState,
  syncConversationContent,
  syncNearBottom,
} from "./page-state.ts";
import type { ChatRole, ConversationFeed } from "./feed.ts";
import type { RecentSessionsPanel } from "../recent-sessions/panel.ts";

interface ConversationPageViewState {
  isStreamingPhase: boolean;
  showRecentSessions: boolean;
  showScrollToBottomButton: boolean;
}

interface CreateConversationPageFlowOptions {
  activityController: ActivityController;
  conversationFeed: ConversationFeed;
  isExtensionUiVisible(): boolean;
  onDynamicCommandsChange(commands: SidebarCommandDefinition[]): void;
  onOpenFileReference(path: string, startLine: number, endLine?: number): void;
  onStreamingPhaseChange(isStreaming: boolean): void;
  recentSessionsPanel: RecentSessionsPanel;
  resetExtensionUi(): void;
  setScrollToBottomVisible(visible: boolean): void;
  viewport: ConversationViewport;
}

export interface ConversationPageFlow {
  appendInlineNote(message: string): void;
  appendLocalUserPrompt(text: string, attachments: UiPendingImageAttachment[]): void;
  appendTransientMessage(role: ChatRole, text: string): void;
  applyEvent(data: unknown): boolean;
  applyState(data: Record<string, unknown>): void;
  beginConversationReplay(): void;
  handleContentChange(): void;
  handleMessageFeedClick(event: MouseEvent): void;
  handleMessageFeedScroll(): void;
  scrollToBottom(force?: boolean): void;
  startFreshConversation(): void;
  syncRecentSessionsVisibility(): void;
}

interface ConversationViewport {
  getChildElementCount(): number;
  isNearBottom(): boolean;
  scrollToBottom(): void;
}

export function createConversationPageFlow(
  options: CreateConversationPageFlowOptions,
): ConversationPageFlow {
  const state = createConversationPageState();
  let viewState = createConversationPageViewState(state, options);
  let shouldSyncStreamingPhase = false;
  const syncViewState = () => {
    if (shouldSyncStreamingPhase) {
      options.onStreamingPhaseChange(viewState.isStreamingPhase);
    } else {
      shouldSyncStreamingPhase = true;
    }
    options.recentSessionsPanel.setVisible(viewState.showRecentSessions);
    options.setScrollToBottomVisible(viewState.showScrollToBottomButton);
  };
  syncViewState();

  return {
    appendInlineNote(message) {
      options.activityController.appendInlineNote(message);
    },
    appendLocalUserPrompt(text, attachments) {
      const key = nextLocalMessageKey(state);
      options.conversationFeed.setMessageText(key, "user", text, "replace");
      if (attachments.length > 0) {
        options.conversationFeed.attachImagesToMessage(key, attachments);
      }
    },
    appendTransientMessage(role, text) {
      options.conversationFeed.setMessageText(
        nextLocalMessageKey(state, role),
        role,
        text,
        "replace",
      );
    },
    applyEvent(data) {
      const resolvedEvent = resolveConversationPageEvent(data);
      if (!resolvedEvent) return false;
      dispatchConversationPageEvent({
        activityController: options.activityController,
        applyMessageReplayQueryResult,
        event: resolvedEvent,
        onDynamicCommandsChange: options.onDynamicCommandsChange,
      });
      return true;
    },
    applyState(data) {
      applyConversationPageStateMessage({
        data,
        onStreamingPhaseChange() {},
        recentSessionsPanel: options.recentSessionsPanel,
        state,
        syncRecentSessionsVisibility() {},
        updateScrollToBottomButton() {},
      });
      refreshViewState();
    },
    beginConversationReplay() {
      beginConversationReplayState(state);
      resetConversationView();
    },
    handleContentChange() {
      syncRecentSessionsVisibility();
      scrollToBottom();
    },
    handleMessageFeedClick(event) {
      handleConversationPageFeedClick(event, event.target, options.onOpenFileReference);
    },
    handleMessageFeedScroll() {
      const changed = syncNearBottom(state, options.viewport.isNearBottom());
      if (!changed) return;
      refreshViewState();
    },
    scrollToBottom,
    startFreshConversation() {
      startFreshConversationState(state);
      resetConversationView();
    },
    syncRecentSessionsVisibility,
  };

  function applyMessageReplayQueryResult(messages: unknown[] | undefined, replace: boolean): void {
    applyConversationReplayQueryResult({
      activityController: options.activityController,
      messages,
      replace,
      resetConversationView,
      state,
      syncRecentSessionsVisibility,
    });
  }

  function resetConversationView(): void {
    options.conversationFeed.reset();
    options.activityController.reset();
    options.resetExtensionUi();
    resetConversationViewState(state);
    refreshViewState();
  }

  function scrollToBottom(force = false): void {
    scrollConversationFeedToBottom({
      force,
      shouldScroll: shouldScrollToBottom(state, force),
      updateScrollToBottomButton,
      viewport: options.viewport,
    });
  }

  function syncRecentSessionsVisibility(): void {
    refreshViewState();
  }

  function updateScrollToBottomButton(): void {
    refreshViewState();
  }

  function refreshViewState(): void {
    const nextViewState = createConversationPageViewState(state, options);
    if (isConversationPageViewStateEqual(viewState, nextViewState)) return;
    viewState = nextViewState;
    syncViewState();
  }
}

function isConversationPageViewStateEqual(
  left: ConversationPageViewState,
  right: ConversationPageViewState,
): boolean {
  return (
    left.isStreamingPhase === right.isStreamingPhase &&
    left.showRecentSessions === right.showRecentSessions &&
    left.showScrollToBottomButton === right.showScrollToBottomButton
  );
}

function createConversationPageViewState(
  state: ReturnType<typeof createConversationPageState>,
  options: Pick<CreateConversationPageFlowOptions, "isExtensionUiVisible" | "viewport">,
): ConversationPageViewState {
  return {
    isStreamingPhase: state.isStreamingPhase,
    showRecentSessions: syncConversationContent(state, hasConversationContent(options)),
    showScrollToBottomButton: shouldShowScrollToBottomButton(state),
  };
}

interface ScrollConversationFeedToBottomOptions {
  force: boolean;
  shouldScroll: boolean;
  updateScrollToBottomButton(): void;
  viewport: ConversationViewport;
}

function handleConversationPageFeedClick(
  _event: MouseEvent,
  target: EventTarget | null,
  onOpenFileReference: (path: string, startLine: number, endLine?: number) => void,
): void {
  if (!(target instanceof Element)) return;
  const reference = target.closest(".file-reference-chip");
  if (!(reference instanceof HTMLButtonElement)) return;
  const path = reference.dataset.path;
  const startLine = Number(reference.dataset.startLine);
  const endLine = reference.dataset.endLine ? Number(reference.dataset.endLine) : undefined;
  if (!path || !Number.isFinite(startLine)) return;
  onOpenFileReference(path, startLine, endLine);
}

function scrollConversationFeedToBottom(options: ScrollConversationFeedToBottomOptions): void {
  if (!options.shouldScroll) {
    options.updateScrollToBottomButton();
    return;
  }
  options.viewport.scrollToBottom();
  options.updateScrollToBottomButton();
}

function hasConversationContent(
  options: Pick<CreateConversationPageFlowOptions, "isExtensionUiVisible" | "viewport">,
): boolean {
  return options.viewport.getChildElementCount() > 0 || options.isExtensionUiVisible();
}
