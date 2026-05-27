import type { UiPendingImageAttachment } from "../protocol.ts";
import {
  shouldCollapseToolText,
  summarizeToolText,
  type ChatRole,
} from "./conversation-feed-state.ts";

export interface ChatMessageRefs {
  article: HTMLElement;
  attachmentStrip?: HTMLElement;
  content: HTMLElement;
  details?: HTMLDetailsElement;
  detailsPre?: HTMLPreElement;
  detailsSummary?: HTMLElement;
  role: ChatRole;
}

interface ConversationFeedDomRenderOptions {
  renderAssistantMarkdown(text: string): DocumentFragment;
  renderPlainTextWithReferences(text: string): DocumentFragment;
}

export function attachConversationMessageImages(
  state: ChatMessageRefs,
  attachments: UiPendingImageAttachment[],
): void {
  clearConversationMessageAttachments(state);
  const strip = document.createElement("div");
  strip.className = "message-image-attachments";
  for (const attachment of attachments) {
    const preview = document.createElement("img");
    preview.className = "message-image-attachment";
    preview.src = attachment.previewUrl;
    preview.alt = attachment.name;
    strip.append(preview);
  }
  state.article.insertBefore(strip, state.content);
  state.attachmentStrip = strip;
}

export function ensureConversationMessageRefs(
  messagesByKey: Map<string, ChatMessageRefs>,
  container: HTMLElement,
  key: string,
  role: ChatRole,
): ChatMessageRefs {
  const existing = messagesByKey.get(key);
  if (existing) {
    if (existing.role !== role) {
      existing.role = role;
      existing.article.className = `chat-message role-${role}`;
      if (role !== "tool") removeToolDetails(existing);
    }
    return existing;
  }

  const article = document.createElement("article");
  article.className = `chat-message role-${role}`;
  const content = document.createElement("div");
  content.className = "chat-content";
  article.append(content);
  container.append(article);
  const created: ChatMessageRefs = { role, article, content };
  messagesByKey.set(key, created);
  return created;
}

export function renderConversationMessageText(
  options: ConversationFeedDomRenderOptions,
  state: ChatMessageRefs,
  text: string,
): void {
  if (state.role === "tool" && shouldCollapseToolText(text)) {
    clearConversationMessageAttachments(state);
    state.content.textContent = summarizeToolText(text);
    const details = ensureToolDetails(state);
    details.pre.textContent = text;
    return;
  }

  if (state.role === "assistant") {
    clearConversationMessageAttachments(state);
    state.content.replaceChildren(options.renderAssistantMarkdown(text));
    removeToolDetails(state);
    return;
  }

  if (state.role === "user" || state.role === "error") {
    if (state.role === "error") clearConversationMessageAttachments(state);
    state.content.replaceChildren(options.renderPlainTextWithReferences(text));
    removeToolDetails(state);
    return;
  }

  clearConversationMessageAttachments(state);
  state.content.textContent = text;
  removeToolDetails(state);
}

function clearConversationMessageAttachments(state: ChatMessageRefs): void {
  if (!state.attachmentStrip) return;
  state.attachmentStrip.remove();
  state.attachmentStrip = undefined;
}

function ensureToolDetails(state: ChatMessageRefs): {
  details: HTMLDetailsElement;
  pre: HTMLPreElement;
} {
  if (state.details && state.detailsPre && state.detailsSummary) {
    return { details: state.details, pre: state.detailsPre };
  }

  const details = document.createElement("details");
  details.className = "chat-tool-details";
  const summary = document.createElement("summary");
  summary.textContent = "查看工具输出";
  const pre = document.createElement("pre");
  details.append(summary, pre);
  state.article.append(details);
  state.details = details;
  state.detailsSummary = summary;
  state.detailsPre = pre;
  return { details, pre };
}

function removeToolDetails(state: ChatMessageRefs): void {
  if (!state.details) return;
  state.details.remove();
  state.details = undefined;
  state.detailsSummary = undefined;
  state.detailsPre = undefined;
}
