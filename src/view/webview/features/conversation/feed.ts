import { h, type ComponentChildren } from "preact";
import type { UiPendingImageAttachment } from "../../../protocol.ts";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";
import { createPreactRenderPort } from "../../ui/preact-render-port.ts";
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
  view: PreactRenderPort;
  onChange(): void;
  renderAssistantMarkdown(text: string): ComponentChildren;
  renderPlainTextWithReferences(text: string): ComponentChildren;
}

export interface ConversationFeed {
  attachImagesToMessage(messageKey: string, attachments: UiPendingImageAttachment[]): void;
  findInlineActivitySlotView(): PreactRenderPort | undefined;
  moveInlineActivitySlotToEnd(): PreactRenderPort;
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
  let viewMessages: ConversationFeedMessageViewState[] = [];
  let renderedMessages: ConversationFeedMessageViewState[] = [];
  let inlineActivitySlotElement: HTMLElement | null = null;
  let inlineActivitySlotView: PreactRenderPort | undefined;
  const renderView = () => {
    options.view.render(
      h(ConversationFeedMessages, {
        messages: viewMessages,
        onInlineActivitySlotRef(element) {
          inlineActivitySlotElement = element;
          inlineActivitySlotView = element ? createPreactRenderPort(element) : undefined;
        },
        renderAssistantMarkdown: options.renderAssistantMarkdown,
        renderPlainTextWithReferences: options.renderPlainTextWithReferences,
      }),
    );
  };
  renderView();

  return {
    attachImagesToMessage(messageKey, attachments) {
      const state = messagesByKey.get(messageKey);
      if (!state || state.role !== "user") return;
      state.attachments = [...attachments];
      refreshView();
      options.onChange();
    },
    findInlineActivitySlotView() {
      return inlineActivitySlotView;
    },
    moveInlineActivitySlotToEnd() {
      const slot = ensureInlineActivitySlotElement({
        getInlineActivitySlot() {
          return inlineActivitySlotElement;
        },
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
      const view = inlineActivitySlotView;
      if (!view) {
        throw new Error("Missing inline activity slot view.");
      }
      return view;
    },
    reset() {
      resetConversationFeedState(feedState);
      messagesByKey.clear();
      messageOrder.length = 0;
      inlineActivitySlotElement = null;
      inlineActivitySlotView = undefined;
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
    const nextViewMessages = messageOrder
      .map((messageKey) => messagesByKey.get(messageKey))
      .filter((message): message is ConversationFeedMessageViewState => !!message)
      .map((message) => ({
        attachments: [...message.attachments],
        key: message.key,
        role: message.role,
        text: message.text,
      }));
    if (isConversationFeedMessagesEqual(renderedMessages, nextViewMessages)) return;
    viewMessages = nextViewMessages;
    renderedMessages = nextViewMessages;
    renderView();
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
  onInlineActivitySlotRef(element: HTMLElement | null): void;
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
          ref: props.onInlineActivitySlotRef,
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
  getInlineActivitySlot(): HTMLElement | null;
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
  const slot = options.getInlineActivitySlot();
  if (!(slot instanceof HTMLElement)) {
    throw new Error("Missing inline activity slot.");
  }
  return slot;
}

function isConversationFeedMessagesEqual(
  left: readonly ConversationFeedMessageViewState[],
  right: readonly ConversationFeedMessageViewState[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftMessage = left[index];
    const rightMessage = right[index];
    if (!leftMessage || !rightMessage) return false;
    if (
      leftMessage.key !== rightMessage.key ||
      leftMessage.role !== rightMessage.role ||
      leftMessage.text !== rightMessage.text
    ) {
      return false;
    }
    if (!isAttachmentListEqual(leftMessage.attachments, rightMessage.attachments)) return false;
  }
  return true;
}

function isAttachmentListEqual(
  left: readonly UiPendingImageAttachment[],
  right: readonly UiPendingImageAttachment[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftAttachment = left[index];
    const rightAttachment = right[index];
    if (!leftAttachment || !rightAttachment) return false;
    if (
      leftAttachment.id !== rightAttachment.id ||
      leftAttachment.previewUrl !== rightAttachment.previewUrl ||
      leftAttachment.name !== rightAttachment.name
    ) {
      return false;
    }
  }
  return true;
}
