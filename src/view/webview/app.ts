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
const systemMessage = expectElement<HTMLElement>("system-message");
const promptInput = expectElement<HTMLTextAreaElement>("prompt-input");
const sendButton = expectElement<HTMLButtonElement>("send-button");
const newSessionButton = expectElement<HTMLButtonElement>("new-session-button");
const abortButton = expectElement<HTMLButtonElement>("abort-button");
const reconnectButton = expectElement<HTMLButtonElement>("reconnect-button");
const toggleControlButton = expectElement<HTMLButtonElement>("toggle-control-button");
const modelProviderInput = expectElement<HTMLInputElement>("model-provider-input");
const modelIdInput = expectElement<HTMLInputElement>("model-id-input");
const setModelButton = expectElement<HTMLButtonElement>("set-model-button");
const thinkingLevelSelect = expectElement<HTMLSelectElement>("thinking-level-select");
const setThinkingButton = expectElement<HTMLButtonElement>("set-thinking-button");
const switchSessionInput = expectElement<HTMLInputElement>("session-switch-input");
const switchSessionButton = expectElement<HTMLButtonElement>("switch-session-button");
const sessionNameInput = expectElement<HTMLInputElement>("session-name-input");
const setSessionNameButton = expectElement<HTMLButtonElement>("set-session-name-button");
const exportPathInput = expectElement<HTMLInputElement>("export-path-input");
const exportHtmlButton = expectElement<HTMLButtonElement>("export-html-button");
const loadModelsButton = expectElement<HTMLButtonElement>("load-models-button");
const sessionStatsButton = expectElement<HTMLButtonElement>("session-stats-button");
const extensionUiPanel = expectElement<HTMLElement>("extension-ui-panel");
const controlPanel = expectElement<HTMLElement>("control-panel");
const eventFeed = expectElement<HTMLElement>("event-feed");
const EVENT_FLUSH_INTERVAL_MS = 24;
const MAX_EVENT_TEXT_PREVIEW = 220;
const queuedEvents: Array<{ kind: "event" | "error"; text: string; raw?: unknown }> = [];
let flushTimer: number | undefined;
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
toggleControlButton.addEventListener("click", () => {
  controlPanel.classList.toggle("hidden");
  const expanded = !controlPanel.classList.contains("hidden");
  toggleControlButton.setAttribute("aria-expanded", expanded ? "true" : "false");
});
setModelButton.addEventListener("click", () => {
  applyModelSetting();
});
modelProviderInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyModelSetting();
});
modelIdInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyModelSetting();
});
setThinkingButton.addEventListener("click", () => {
  applyThinkingLevel();
});
thinkingLevelSelect.addEventListener("change", () => {
  applyThinkingLevel();
});
switchSessionButton.addEventListener("click", () => {
  const sessionPath = switchSessionInput.value.trim();
  if (!sessionPath) return;
  postUiMessage({ type: "switch_session", sessionPath });
});
setSessionNameButton.addEventListener("click", () => {
  applySessionName();
});
sessionNameInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applySessionName();
});
exportHtmlButton.addEventListener("click", () => {
  const outputPath = exportPathInput.value.trim();
  if (outputPath) postUiMessage({ type: "export_html", outputPath });
  else postUiMessage({ type: "export_html" });
});
loadModelsButton.addEventListener("click", () => {
  postUiMessage({ type: "get_available_models" });
});
sessionStatsButton.addEventListener("click", () => {
  postUiMessage({ type: "get_session_stats" });
});

window.addEventListener("message", (event: MessageEvent<HostToUiMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object" || !("type" in message)) return;

  if (message.type === "notice") {
    renderSystemNotice(message.message);
    return;
  }
  if (message.type === "error") {
    queueEvent("error", message.message, { scope: message.scope, message: message.message });
    return;
  }
  if (message.type === "event") {
    queueEvent("event", formatEventMessage(message.data), message.data);
    return;
  }
  if (message.type === "state") {
    updateState(message.data as Record<string, unknown>);
    return;
  }
  if (message.type === "extension_ui_request") {
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
}

function updateState(data: Record<string, unknown>): void {
  const view = asRecord(data.view);
  const rpc = asRecord(data.rpc);
  const phase = readString(view?.phase) ?? "idle";
  updateStatusBadge(phase);
  if (phase === "process_dead") reconnectButton.classList.remove("hidden");
  else reconnectButton.classList.add("hidden");
  const sessionName = readString(asRecord(rpc)?.sessionName);
  title.textContent = sessionName ? `就绪 · ${sessionName}` : "就绪";
}

function updateStatusBadge(statusKey: string, statusText?: string): void {
  statusBadge.textContent = statusText?.trim() ? statusText : mapStatusLabel(statusKey);
  statusBadge.dataset.statusKey = statusKey;
}

function queueEvent(kind: "event" | "error", text: string, raw?: unknown): void {
  queuedEvents.push({ kind, text, raw });
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
    eventFeed.prepend(createEventCard(next.kind, next.text, next.raw));
  }
}

function createEventCard(kind: "event" | "error", text: string, raw?: unknown): HTMLElement {
  const article = document.createElement("article");
  article.className = `message-card ${kind === "error" ? "error-card" : "event-card"}`;
  article.innerHTML = `<p>${escapeHtml(truncateText(text, MAX_EVENT_TEXT_PREVIEW))}</p>`;

  if (raw !== undefined) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看原始数据";
    const pre = document.createElement("pre");
    pre.textContent = stringifyJson(raw);
    details.append(summary, pre);
    article.append(details);
  }

  return article;
}

function sendPrompt(): void {
  const text = promptInput.value.trim();
  if (!text) return;
  postUiMessage({ type: "send_prompt", text });
  promptInput.value = "";
}

function applyModelSetting(): void {
  const provider = modelProviderInput.value.trim();
  const modelId = modelIdInput.value.trim();
  if (!provider || !modelId) return;
  postUiMessage({ type: "set_model", provider, modelId });
}

function applyThinkingLevel(): void {
  const level = thinkingLevelSelect.value;
  postUiMessage({ type: "set_thinking_level", level });
}

function applySessionName(): void {
  const name = sessionNameInput.value.trim();
  if (!name) return;
  postUiMessage({ type: "set_session_name", name });
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
