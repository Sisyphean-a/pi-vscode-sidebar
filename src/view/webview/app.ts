import { createExtensionUiRenderer } from "./extension-ui.ts";
import type { HostToUiMessage } from "../protocol.ts";
import { SIDEBAR_TEMPLATE } from "./template.ts";
import {
  asRecord,
  escapeHtml,
  formatEventMessage,
  mapStatusLabel,
  readString,
  stringifyJson,
  truncateText,
} from "./ui-text.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

root.innerHTML = SIDEBAR_TEMPLATE;

const statusBadge = expectElement<HTMLSpanElement>("status-badge");
const title = expectElement<HTMLElement>("title");
const modelChip = expectElement<HTMLElement>("model-chip");
const systemMessage = expectElement<HTMLElement>("system-message");
const promptInput = expectElement<HTMLTextAreaElement>("prompt-input");
const sendButton = expectElement<HTMLButtonElement>("send-button");
const newSessionButton = expectElement<HTMLButtonElement>("new-session-button");
const abortButton = expectElement<HTMLButtonElement>("abort-button");
const reconnectButton = expectElement<HTMLButtonElement>("reconnect-button");
const thinkingLevelSelect = expectElement<HTMLSelectElement>("thinking-level-select");
const extensionUiPanel = expectElement<HTMLElement>("extension-ui-panel");
const eventFeed = expectElement<HTMLElement>("event-feed");
const EVENT_FLUSH_INTERVAL_MS = 24;
const MAX_EVENT_TEXT_PREVIEW = 220;
const queuedEvents: Array<{
  kind: "event" | "error";
  text: string;
  raw?: unknown;
  streamKey?: string;
  completeStream?: boolean;
}> = [];
const streamingCards = new Map<string, HTMLElement>();
let flushTimer: number | undefined;
let bootingNoticeResolved = false;
const renderExtensionUiRequest = createExtensionUiRenderer({
  panel: extensionUiPanel,
  escapeHtml,
  expectElement,
  postResponse(requestId, payload) {
    postUiMessage({ type: "respond_extension_ui", requestId, payload });
  },
  updateStatus(statusKey, statusText) {
    updateStatusBadge(statusKey, statusText);
  },
  updateTitle(nextTitle) {
    title.textContent = nextTitle;
  },
  setEditorText(text) {
    promptInput.value = text;
    promptInput.focus();
  },
  queueNotice(message) {
    queueEvent("event", message, { type: "extension_ui_notice", message });
  },
});

sendButton.addEventListener("click", () => {
  sendPrompt();
});
promptInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  sendPrompt();
});
newSessionButton.addEventListener("click", () => {
  postUiMessage({ type: "new_session" });
});
abortButton.addEventListener("click", () => {
  postUiMessage({ type: "abort" });
});
reconnectButton.addEventListener("click", () => {
  postUiMessage({ type: "new_session" });
});
thinkingLevelSelect.addEventListener("change", () => {
  const level = thinkingLevelSelect.value;
  postUiMessage({ type: "set_thinking_level", level });
});

window.addEventListener("message", (event: MessageEvent<HostToUiMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object" || !("type" in message)) return;

  if (message.type === "notice") {
    renderSystemNotice(message.message);
    return;
  }
  if (message.type === "error") {
    resolveBootingNotice("process_dead");
    queueEvent("error", message.message, { scope: message.scope, message: message.message });
    return;
  }
  if (message.type === "event") {
    resolveBootingNotice("idle");
    const streamMeta = resolveEventStreamMeta(message.data);
    queueEvent("event", formatEventMessage(message.data), message.data, streamMeta);
    return;
  }
  if (message.type === "state") {
    updateState(message.data as Record<string, unknown>);
    return;
  }
  if (message.type === "extension_ui_request") {
    resolveBootingNotice("idle");
    renderExtensionUiRequest(message.data as Record<string, unknown>);
  }
});

postUiMessage({ type: "ui_ready" });

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}

function renderSystemNotice(text: string): void {
  updateStatusBadge("connected", "已连接");
  systemMessage.innerHTML = `<p>${escapeHtml(text)}</p>`;
  bootingNoticeResolved = true;
}

function updateState(data: Record<string, unknown>): void {
  const view = asRecord(data.view);
  const rpc = asRecord(data.rpc);
  const phase = readString(view?.phase) ?? "idle";
  resolveBootingNotice(phase);
  updateStatusBadge(phase);
  reconnectButton.classList.toggle("hidden", phase !== "process_dead");
  syncThinkingLevel(rpc);
  updateModelChip(rpc);

  const sessionName = readString(rpc?.sessionName);
  title.textContent = sessionName ? `就绪 · ${sessionName}` : "就绪";
}

function resolveBootingNotice(phase: string): void {
  if (bootingNoticeResolved) return;
  const text =
    phase === "process_dead" ? "Pi 进程已退出，请点击重连或新对话重试。" : "已连接，可开始对话。";
  systemMessage.innerHTML = `<p>${escapeHtml(text)}</p>`;
  bootingNoticeResolved = true;
}

function syncThinkingLevel(rpc: Record<string, unknown> | undefined): void {
  const nextLevel = readString(rpc?.thinkingLevel);
  if (!nextLevel) return;
  const hasOption = Array.from(thinkingLevelSelect.options).some(
    (option) => option.value === nextLevel,
  );
  if (hasOption) thinkingLevelSelect.value = nextLevel;
}

function updateModelChip(rpc: Record<string, unknown> | undefined): void {
  const modelRecord = asRecord(rpc?.model);
  const provider = readString(modelRecord?.provider);
  const modelId = readString(modelRecord?.id);
  if (!provider && !modelId) {
    modelChip.textContent = "模型：按 Pi 配置";
    return;
  }
  if (!provider) {
    modelChip.textContent = `模型：${modelId}`;
    return;
  }
  if (!modelId) {
    modelChip.textContent = `模型：${provider}`;
    return;
  }
  modelChip.textContent = `模型：${provider}/${modelId}`;
}

function updateStatusBadge(statusKey: string, statusText?: string): void {
  statusBadge.textContent = statusText?.trim() ? statusText : mapStatusLabel(statusKey);
  statusBadge.dataset.statusKey = statusKey;
}

function queueEvent(
  kind: "event" | "error",
  text: string,
  raw?: unknown,
  streamMeta?: { streamKey?: string; completeStream?: boolean },
): void {
  queuedEvents.push({
    kind,
    text,
    raw,
    streamKey: streamMeta?.streamKey,
    completeStream: streamMeta?.completeStream,
  });
  scheduleEventFlush();
}

function scheduleEventFlush(): void {
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    flushEventQueue();
  }, EVENT_FLUSH_INTERVAL_MS);
}

function flushEventQueue(): void {
  while (queuedEvents.length > 0) {
    const next = queuedEvents.shift();
    if (!next) continue;
    if (next.streamKey) {
      const existing = streamingCards.get(next.streamKey);
      if (existing) {
        updateEventCard(existing, next.kind, next.text, next.raw);
      } else {
        const created = createEventCard(next.kind, next.text, next.raw);
        eventFeed.prepend(created);
        streamingCards.set(next.streamKey, created);
      }
      if (next.completeStream) {
        streamingCards.delete(next.streamKey);
      }
      continue;
    }
    eventFeed.prepend(createEventCard(next.kind, next.text, next.raw));
  }
}

function createEventCard(kind: "event" | "error", text: string, raw?: unknown): HTMLElement {
  const article = document.createElement("article");
  article.className = `message-card ${kind === "error" ? "error-card" : "event-card"}`;
  article.append(createCardText(text));

  if (raw !== undefined) {
    article.append(createRawDetails(raw));
  }

  return article;
}

function updateEventCard(
  card: HTMLElement,
  kind: "event" | "error",
  text: string,
  raw: unknown,
): void {
  card.className = `message-card ${kind === "error" ? "error-card" : "event-card"}`;
  const textNode = card.querySelector("p");
  if (textNode) textNode.textContent = truncateText(text, MAX_EVENT_TEXT_PREVIEW);
  else card.prepend(createCardText(text));

  if (raw === undefined) return;
  const details = card.querySelector("details");
  const pre = details?.querySelector("pre");
  if (pre) pre.textContent = stringifyJson(raw);
  else card.append(createRawDetails(raw));
}

function createCardText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = truncateText(text, MAX_EVENT_TEXT_PREVIEW);
  return paragraph;
}

function createRawDetails(raw: unknown): HTMLElement {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "查看原始数据";
  const pre = document.createElement("pre");
  pre.textContent = stringifyJson(raw);
  details.append(summary, pre);
  return details;
}

function resolveEventStreamMeta(data: unknown): { streamKey?: string; completeStream?: boolean } {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return {};

  if (type === "message_update") {
    const responseId = readResponseId(event);
    const assistantEventType = readString(asRecord(event.assistantMessageEvent)?.type);
    if (assistantEventType === "text_start" || assistantEventType === "text_delta") {
      return { streamKey: responseId ? `assistant:${responseId}` : "assistant:active" };
    }
    if (assistantEventType === "text_end") {
      return {
        streamKey: responseId ? `assistant:${responseId}` : "assistant:active",
        completeStream: true,
      };
    }
    if (assistantEventType?.startsWith("toolcall_")) {
      const toolName = readToolNameFromEvent(event) ?? "tool";
      const streamKey = responseId ? `tool:${responseId}:${toolName}` : `tool:${toolName}`;
      return {
        streamKey,
        completeStream: assistantEventType === "toolcall_end",
      };
    }
    return {};
  }

  if (type === "message_end") {
    const message = asRecord(event.message);
    const role = readString(message?.role);
    if (role === "assistant") {
      const responseId = readResponseId(event);
      return {
        streamKey: responseId ? `assistant:${responseId}` : "assistant:active",
        completeStream: true,
      };
    }
    if (role === "toolResult") {
      const toolName = readString(message?.toolName) ?? "tool";
      const streamKey = readString(message?.toolCallId) ?? `tool:${toolName}`;
      return { streamKey, completeStream: true };
    }
  }

  return {};
}

function readResponseId(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const fromMessage = readString(message?.responseId);
  if (fromMessage) return fromMessage;
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const partial = asRecord(assistantEvent?.partial);
  return readString(partial?.responseId);
}

function readToolNameFromEvent(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const content = message?.content;
  if (!Array.isArray(content)) return readString(message?.toolName);
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "toolCall") continue;
    const name = readString(entry.name);
    if (name) return name;
  }
  return readString(message?.toolName);
}

function sendPrompt(): void {
  const text = promptInput.value.trim();
  if (!text) return;
  postUiMessage({ type: "send_prompt", text });
  promptInput.value = "";
}

function postUiMessage(message: Record<string, unknown>): void {
  const type = readString(message.type);
  if (type === "ui_ready") {
    vscode.postMessage(message);
    return;
  }
  vscode.postMessage({
    ...message,
    correlationId: createCorrelationId(),
  });
}

function createCorrelationId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `ui-${timePart}-${randomPart}`;
}
