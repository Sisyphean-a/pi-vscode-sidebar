import { createExtensionUiRenderer } from "./extension-ui.ts";
import type { HostToUiMessage } from "../protocol.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

root.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">PI SIDEBAR</p>
        <h1 id="title">Ready</h1>
      </div>
      <span id="status-badge" class="badge">idle</span>
    </header>
    <section class="controls card">
      <div class="line">
        <button id="new-session-button" type="button">New Session</button>
        <button id="abort-button" type="button">Stop</button>
        <button id="reconnect-button" class="hidden" type="button">Reconnect</button>
      </div>
      <div class="line">
        <input id="model-provider-input" placeholder="provider" />
        <input id="model-id-input" placeholder="model id" />
        <button id="set-model-button" type="button">Set Model</button>
      </div>
      <div class="line">
        <select id="thinking-level-select">
          <option value="off">off</option>
          <option value="minimal">minimal</option>
          <option value="low">low</option>
          <option value="medium" selected>medium</option>
          <option value="high">high</option>
          <option value="xhigh">xhigh</option>
        </select>
        <button id="set-thinking-button" type="button">Set Thinking</button>
        <input id="session-switch-input" placeholder="session path" />
        <button id="switch-session-button" type="button">Switch</button>
      </div>
      <div class="line">
        <input id="session-name-input" placeholder="session name" />
        <button id="set-session-name-button" type="button">Set Name</button>
        <input id="export-path-input" placeholder="export path (optional)" />
        <button id="export-html-button" type="button">Export HTML</button>
      </div>
      <div class="line">
        <button id="load-models-button" type="button">Load Models</button>
        <button id="session-stats-button" type="button">Session Stats</button>
      </div>
    </section>
    <section id="extension-ui-panel" class="card hidden"></section>
    <section class="feed">
      <article id="system-message" class="card"><p>Pi Sidebar is booting...</p></article>
      <div id="event-feed" class="event-feed"></div>
    </section>
    <footer class="composer">
      <textarea id="prompt-input" rows="3" placeholder="Type your prompt..."></textarea>
      <button id="send-button" type="button">Send</button>
    </footer>
  </main>
`;

const statusBadge = expectElement<HTMLSpanElement>("status-badge");
const title = expectElement<HTMLElement>("title");
const systemMessage = expectElement<HTMLElement>("system-message");
const promptInput = expectElement<HTMLTextAreaElement>("prompt-input");
const sendButton = expectElement<HTMLButtonElement>("send-button");
const newSessionButton = expectElement<HTMLButtonElement>("new-session-button");
const abortButton = expectElement<HTMLButtonElement>("abort-button");
const reconnectButton = expectElement<HTMLButtonElement>("reconnect-button");
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
  const text = promptInput.value.trim();
  if (!text) return;
  postUiMessage({ type: "send_prompt", text });
  promptInput.value = "";
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
setModelButton.addEventListener("click", () => {
  const provider = modelProviderInput.value.trim();
  const modelId = modelIdInput.value.trim();
  if (!provider || !modelId) return;
  postUiMessage({ type: "set_model", provider, modelId });
});
setThinkingButton.addEventListener("click", () => {
  const level = thinkingLevelSelect.value;
  postUiMessage({ type: "set_thinking_level", level });
});
switchSessionButton.addEventListener("click", () => {
  const sessionPath = switchSessionInput.value.trim();
  if (!sessionPath) return;
  postUiMessage({ type: "switch_session", sessionPath });
});
setSessionNameButton.addEventListener("click", () => {
  const name = sessionNameInput.value.trim();
  if (!name) return;
  postUiMessage({ type: "set_session_name", name });
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
  updateStatusBadge("connected", "connected");
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
  title.textContent = sessionName ? `Ready · ${sessionName}` : "Ready";
}

function updateStatusBadge(statusKey: string, statusText?: string): void {
  statusBadge.textContent = statusText?.trim() ? statusText : statusKey;
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
  article.className = `card ${kind === "error" ? "error-card" : "event-card"}`;
  article.innerHTML = `<p>${escapeHtml(truncateText(text, MAX_EVENT_TEXT_PREVIEW))}</p>`;

  if (raw !== undefined) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看原始 JSON";
    const pre = document.createElement("pre");
    pre.textContent = stringifyJson(raw);
    details.append(summary, pre);
    article.append(details);
  }

  return article;
}

function formatEventMessage(data: unknown): string {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!type) return JSON.stringify(data);

  if (type === "query_result") {
    const command = readString(event?.command) ?? "unknown";
    return `Query result received: ${command}`;
  }

  const toolName = readString(event?.toolName) ?? readString(event?.tool_name);
  if (type === "tool_execution_start") {
    return `Tool started: ${toolName ?? "unknown"}`;
  }
  if (type === "tool_execution_update") {
    return `Tool update: ${toolName ?? "unknown"}`;
  }
  if (type === "tool_execution_end") {
    return `Tool finished: ${toolName ?? "unknown"}`;
  }
  if (type === "message_update") {
    const text = readString(event?.text);
    return text ? `Assistant: ${text.slice(0, 160)}` : "Assistant message update";
  }
  if (type === "agent_start") return "Agent started";
  if (type === "agent_end") return "Agent finished";
  return `Event: ${type}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
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
