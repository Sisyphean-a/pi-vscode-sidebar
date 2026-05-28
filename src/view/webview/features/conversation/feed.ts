import { effect, signal } from "@preact/signals";
import { h, render, type ComponentChildren } from "preact";
import type { UiPendingImageAttachment } from "../../../protocol.ts";
import {
  applyMessageText,
  createConversationFeedState,
  shouldCollapseToolText,
  resetConversationFeedState,
  summarizeToolText,
  type ChatRole,
} from "./feed-state.ts";

export type { ChatRole } from "./feed-state.ts";
const INLINE_ACTIVITY_SLOT_KEY = "activity:current";
type FeedBlockRole = ChatRole | "activity";

interface CreateConversationFeedOptions {
  container: HTMLElement;
  onChange(): void;
  renderAssistantMarkdown(text: string): ComponentChildren;
  renderPlainTextWithReferences(text: string): ComponentChildren;
}

export interface ConversationFeed {
  attachImagesToMessage(messageKey: string, attachments: UiPendingImageAttachment[]): void;
  ensureInlineActivitySlot(): HTMLElement;
  findInlineActivitySlot(): HTMLElement | null;
  moveInlineActivitySlotToEnd(): HTMLElement;
  reset(): void;
  setMessageText(
    key: string,
    role: ChatRole,
    nextText: string,
    mode: "merge" | "replace",
    fallbackKeys?: string[],
  ): void;
}

interface ConversationFeedMessageViewState {
  attachments: UiPendingImageAttachment[];
  key: string;
  role: FeedBlockRole;
  text: string;
}

export function createConversationFeed(options: CreateConversationFeedOptions): ConversationFeed {
  const feedState = createConversationFeedState();
  const messagesByKey = new Map<string, ConversationFeedMessageViewState>();
  const messageOrder: string[] = [];
  const viewSignal = signal<ConversationFeedMessageViewState[]>([]);

  effect(() => {
    render(
      h(ConversationFeedMessages, {
        messages: viewSignal.value,
        renderAssistantMarkdown: options.renderAssistantMarkdown,
        renderPlainTextWithReferences: options.renderPlainTextWithReferences,
      }),
      options.container,
    );
  });

  return {
    attachImagesToMessage(messageKey, attachments) {
      const state = messagesByKey.get(messageKey);
      if (!state || state.role !== "user") return;
      state.attachments = [...attachments];
      refreshView();
      options.onChange();
    },
    ensureInlineActivitySlot() {
      return ensureInlineActivitySlotElement({
        container: options.container,
        messageOrder,
        messagesByKey,
        refreshView,
      });
    },
    findInlineActivitySlot() {
      return findInlineActivitySlotElement(options.container);
    },
    moveInlineActivitySlotToEnd() {
      const slot = ensureInlineActivitySlotElement({
        container: options.container,
        messageOrder,
        messagesByKey,
        refreshView,
      });
      const currentIndex = messageOrder.indexOf(INLINE_ACTIVITY_SLOT_KEY);
      if (currentIndex !== -1 && currentIndex !== messageOrder.length - 1) {
        messageOrder.splice(currentIndex, 1);
        messageOrder.push(INLINE_ACTIVITY_SLOT_KEY);
        refreshView();
      }
      return slot;
    },
    reset() {
      resetConversationFeedState(feedState);
      messagesByKey.clear();
      messageOrder.length = 0;
      refreshView();
    },
    setMessageText(key, role, nextText, mode, fallbackKeys = []) {
      const result = applyMessageText(feedState, { fallbackKeys, key, mode, nextText, role });
      promoteRenderedMessageKey(messagesByKey, messageOrder, result.key, result.promotedFromKey);
      if (!result.changed) return;
      const existing = messagesByKey.get(result.key);
      const attachments = result.role === "user" ? (existing?.attachments ?? []) : [];
      messagesByKey.set(result.key, {
        attachments,
        key: result.key,
        role: result.role,
        text: result.text,
      });
      if (!messageOrder.includes(result.key)) {
        messageOrder.push(result.key);
      }
      refreshView();
      options.onChange();
    },
  };

  function refreshView(): void {
    viewSignal.value = messageOrder
      .map((messageKey) => messagesByKey.get(messageKey))
      .filter((message): message is ConversationFeedMessageViewState => !!message)
      .map((message) => ({
        attachments: [...message.attachments],
        key: message.key,
        role: message.role,
        text: message.text,
      }));
  }
}

function promoteRenderedMessageKey(
  messagesByKey: Map<string, ConversationFeedMessageViewState>,
  messageOrder: string[],
  key: string,
  fallbackKey: string | undefined,
): void {
  if (!fallbackKey || messagesByKey.has(key)) return;
  const state = messagesByKey.get(fallbackKey);
  if (!state) return;
  const fallbackIndex = messageOrder.indexOf(fallbackKey);
  if (fallbackIndex !== -1) {
    messageOrder[fallbackIndex] = key;
  }
  messagesByKey.set(key, { ...state, key });
  messagesByKey.delete(fallbackKey);
}

interface ConversationFeedMessagesProps {
  messages: ConversationFeedMessageViewState[];
  renderAssistantMarkdown(text: string): ComponentChildren;
  renderPlainTextWithReferences(text: string): ComponentChildren;
}

function ConversationFeedMessages(props: ConversationFeedMessagesProps) {
  return props.messages.map((message) =>
    message.role === "activity"
      ? h("section", {
          class: "chat-inline-activity-slot",
          key: message.key,
          "data-inline-activity-slot": "true",
        })
      : h(
          "article",
          {
            class: `chat-message role-${message.role}`,
            key: message.key,
          },
          renderMessageAttachments(message),
          renderMessageContent(message, props),
          renderToolDetails(message),
        ),
  );
}

function renderMessageAttachments(message: ConversationFeedMessageViewState): ComponentChildren {
  if (message.role !== "user" || message.attachments.length === 0) return undefined;
  return h(
    "div",
    { class: "message-image-attachments" },
    message.attachments.map((attachment) =>
      h("img", {
        key: attachment.id,
        class: "message-image-attachment",
        src: attachment.previewUrl,
        alt: attachment.name,
      }),
    ),
  );
}

function renderMessageContent(
  message: ConversationFeedMessageViewState,
  options: ConversationFeedMessagesProps,
): ComponentChildren {
  if (message.role === "assistant") {
    return h("div", { class: "chat-content" }, options.renderAssistantMarkdown(message.text));
  }
  if (message.role === "user" || message.role === "error") {
    return h("div", { class: "chat-content" }, options.renderPlainTextWithReferences(message.text));
  }
  if (message.role === "tool" && shouldCollapseToolText(message.text)) {
    return h("div", { class: "chat-content" }, summarizeToolText(message.text));
  }
  return h("div", { class: "chat-content" }, message.text);
}

function renderToolDetails(message: ConversationFeedMessageViewState): ComponentChildren {
  if (message.role !== "tool" || !shouldCollapseToolText(message.text)) return undefined;
  return h(
    "details",
    { class: "chat-tool-details" },
    h("summary", null, "查看工具输出"),
    h("pre", null, message.text),
  );
}

function ensureInlineActivitySlotElement(options: {
  container: HTMLElement;
  messageOrder: string[];
  messagesByKey: Map<string, ConversationFeedMessageViewState>;
  refreshView(): void;
}): HTMLElement {
  if (!options.messageOrder.includes(INLINE_ACTIVITY_SLOT_KEY)) {
    options.messageOrder.push(INLINE_ACTIVITY_SLOT_KEY);
    options.messagesByKey.set(INLINE_ACTIVITY_SLOT_KEY, {
      attachments: [],
      key: INLINE_ACTIVITY_SLOT_KEY,
      role: "activity",
      text: "",
    });
    options.refreshView();
  }
  const slot = options.container.querySelector("[data-inline-activity-slot='true']");
  if (!(slot instanceof HTMLElement)) {
    throw new Error("Missing inline activity slot.");
  }
  return slot;
}

function findInlineActivitySlotElement(container: HTMLElement): HTMLElement | null {
  const slot = container.querySelector("[data-inline-activity-slot='true']");
  return slot instanceof HTMLElement ? slot : null;
}
