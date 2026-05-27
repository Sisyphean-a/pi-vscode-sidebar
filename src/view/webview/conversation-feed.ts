import type { UiPendingImageAttachment } from "../protocol.ts";
import {
  applyMessageText,
  createConversationFeedState,
  resetConversationFeedState,
  type ChatRole,
} from "./conversation-feed-state.ts";
import {
  attachConversationMessageImages,
  ensureConversationMessageRefs,
  renderConversationMessageText,
  type ChatMessageRefs,
} from "./conversation-feed-dom.ts";

export type { ChatRole } from "./conversation-feed-state.ts";

interface CreateConversationFeedOptions {
  container: HTMLElement;
  onChange(): void;
  renderAssistantMarkdown(text: string): DocumentFragment;
  renderPlainTextWithReferences(text: string): DocumentFragment;
}

export interface ConversationFeed {
  attachImagesToMessage(messageKey: string, attachments: UiPendingImageAttachment[]): void;
  reset(): void;
  setMessageText(
    key: string,
    role: ChatRole,
    nextText: string,
    mode: "merge" | "replace",
    fallbackKeys?: string[],
  ): void;
}

export function createConversationFeed(options: CreateConversationFeedOptions): ConversationFeed {
  const feedState = createConversationFeedState();
  const messagesByKey = new Map<string, ChatMessageRefs>();

  return {
    attachImagesToMessage(messageKey, attachments) {
      const state = messagesByKey.get(messageKey);
      if (!state || state.role !== "user") return;
      attachConversationMessageImages(state, attachments);
    },
    reset() {
      resetConversationFeedState(feedState);
      messagesByKey.clear();
      options.container.replaceChildren();
    },
    setMessageText(key, role, nextText, mode, fallbackKeys = []) {
      const result = applyMessageText(feedState, { fallbackKeys, key, mode, nextText, role });
      promoteRenderedMessageKey(messagesByKey, result.key, result.promotedFromKey);
      if (!result.changed) return;
      const state = ensureConversationMessageRefs(
        messagesByKey,
        options.container,
        result.key,
        result.role,
      );
      renderConversationMessageText(options, state, result.text);
      options.onChange();
    },
  };
}

function promoteRenderedMessageKey(
  messagesByKey: Map<string, ChatMessageRefs>,
  key: string,
  fallbackKey: string | undefined,
): void {
  if (!fallbackKey || messagesByKey.has(key)) return;
  const state = messagesByKey.get(fallbackKey);
  if (!state) return;
  messagesByKey.set(key, state);
  messagesByKey.delete(fallbackKey);
}
