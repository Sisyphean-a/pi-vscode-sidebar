import { effect, signal } from "@preact/signals";
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
  extensionUiPanel: HTMLElement;
  messageFeed: HTMLElement;
  onDynamicCommandsChange(commands: SidebarCommandDefinition[]): void;
  onOpenFileReference(path: string, startLine: number, endLine?: number): void;
  onStreamingPhaseChange(isStreaming: boolean): void;
  recentSessionsPanel: RecentSessionsPanel;
  scrollToBottomButton: HTMLButtonElement;
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

export function createConversationPageFlow(
  options: CreateConversationPageFlowOptions,
): ConversationPageFlow {
  const state = createConversationPageState();
  const viewStateSignal = signal(
    createConversationPageViewState(state, options.messageFeed, options.extensionUiPanel),
  );
  let shouldSyncStreamingPhase = false;

  effect(() => {
    const viewState = viewStateSignal.value;
    if (shouldSyncStreamingPhase) {
      options.onStreamingPhaseChange(viewState.isStreamingPhase);
    } else {
      shouldSyncStreamingPhase = true;
    }
    options.recentSessionsPanel.setVisible(viewState.showRecentSessions);
    options.scrollToBottomButton.classList.toggle("hidden", !viewState.showScrollToBottomButton);
  });

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
      syncNearBottom(state, isNearBottom(options.messageFeed));
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
    options.extensionUiPanel.classList.add("hidden");
    resetConversationViewState(state);
    refreshViewState();
  }

  function scrollToBottom(force = false): void {
    scrollConversationFeedToBottom({
      force,
      messageFeed: options.messageFeed,
      shouldScroll: shouldScrollToBottom(state, force),
      updateScrollToBottomButton,
    });
  }

  function syncRecentSessionsVisibility(): void {
    refreshViewState();
  }

  function updateScrollToBottomButton(): void {
    refreshViewState();
  }

  function refreshViewState(): void {
    viewStateSignal.value = createConversationPageViewState(
      state,
      options.messageFeed,
      options.extensionUiPanel,
    );
  }
}

function createConversationPageViewState(
  state: ReturnType<typeof createConversationPageState>,
  messageFeed: HTMLElement,
  extensionUiPanel: HTMLElement,
): ConversationPageViewState {
  return {
    isStreamingPhase: state.isStreamingPhase,
    showRecentSessions: syncConversationContent(
      state,
      hasConversationContent(messageFeed, extensionUiPanel),
    ),
    showScrollToBottomButton: shouldShowScrollToBottomButton(state),
  };
}

interface ScrollConversationFeedToBottomOptions {
  force: boolean;
  messageFeed: HTMLElement;
  shouldScroll: boolean;
  updateScrollToBottomButton(): void;
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
  options.messageFeed.scrollTop = options.messageFeed.scrollHeight;
  options.updateScrollToBottomButton();
}

function hasConversationContent(messageFeed: HTMLElement, extensionUiPanel: HTMLElement): boolean {
  return messageFeed.childElementCount > 0 || !extensionUiPanel.classList.contains("hidden");
}

function isNearBottom(messageFeed: HTMLElement): boolean {
  return messageFeed.scrollHeight - messageFeed.scrollTop - messageFeed.clientHeight <= 16;
}
