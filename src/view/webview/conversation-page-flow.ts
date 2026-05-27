import type { SidebarCommandDefinition } from "../../shared/sidebar-commands.ts";
import type { UiPendingImageAttachment } from "../protocol.ts";
import type { ActivityController } from "./activity-controller.ts";
import {
  hasConversationContent,
  handleConversationPageFeedClick,
  isNearBottom,
  scrollConversationFeedToBottom,
} from "./conversation-page-dom.ts";
import { dispatchConversationPageEvent } from "./conversation-page-event-dispatch.ts";
import {
  applyConversationPageStateMessage,
  applyConversationReplayQueryResult,
} from "./conversation-page-effects.ts";
import { resolveConversationPageEvent } from "./conversation-page-events.ts";
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
} from "./conversation-page-state.ts";
import type { ChatRole, ConversationFeed } from "./conversation-feed.ts";
import type { RecentSessionsPanel } from "./recent-sessions.ts";

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
        onStreamingPhaseChange: options.onStreamingPhaseChange,
        recentSessionsPanel: options.recentSessionsPanel,
        state,
        syncRecentSessionsVisibility,
        updateScrollToBottomButton,
      });
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
      updateScrollToBottomButton();
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
    updateScrollToBottomButton();
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
    options.recentSessionsPanel.setVisible(
      syncConversationContent(
        state,
        hasConversationContent(options.messageFeed, options.extensionUiPanel),
      ),
    );
  }

  function updateScrollToBottomButton(): void {
    options.scrollToBottomButton.classList.toggle("hidden", !shouldShowScrollToBottomButton(state));
  }
}
