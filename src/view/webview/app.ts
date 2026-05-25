import { createExtensionUiRenderer } from "./extension-ui.ts";
import type { HostToUiMessage } from "../protocol.ts";
import { SIDEBAR_TEMPLATE } from "./template.ts";
import { asRecord, escapeHtml, mapStatusLabel, readString } from "./ui-text.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

type ChatRole = "user" | "assistant" | "tool" | "error";

interface ChatMessageRefs {
  role: ChatRole;
  article: HTMLElement;
  roleLabel: HTMLDivElement;
  content: HTMLParagraphElement;
  details?: HTMLDetailsElement;
  detailsSummary?: HTMLElement;
  detailsPre?: HTMLPreElement;
}

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
const messageFeed = expectElement<HTMLElement>("message-feed");
const messagesByKey = new Map<string, ChatMessageRefs>();
const messageTextByKey = new Map<string, string>();
const TOOL_COLLAPSE_MIN_LENGTH = 180;
let bootingNoticeResolved = false;
let localMessageSeq = 0;

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
    appendTransientMessage("tool", message);
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
    appendTransientMessage("error", message.message);
    return;
  }
  if (message.type === "event") {
    resolveBootingNotice("idle");
    applyAgentEvent(message.data);
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

function applyAgentEvent(data: unknown): void {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return;

  if (type === "query_result") {
    applyQueryResultEvent(event);
    return;
  }
  if (type === "message_start") {
    applyMessageStart(event);
    return;
  }
  if (type === "message_update") {
    applyMessageUpdate(event);
    return;
  }
  if (type === "message_end") {
    applyMessageEnd(event);
    return;
  }
  if (
    type === "tool_execution_start" ||
    type === "tool_execution_update" ||
    type === "tool_execution_end"
  ) {
    applyToolExecutionEvent(event, type);
  }
}

function applyMessageStart(event: Record<string, unknown>): void {
  const message = asRecord(event.message);
  const role = readString(message?.role);
  if (role === "assistant") {
    const key = resolveAssistantStreamKey(event);
    ensureMessage(key, "assistant");
    return;
  }
  if (role === "toolResult") {
    const key = resolveToolResultKey(event, readString(message?.toolName) ?? "tool");
    ensureMessage(key, "tool");
  }
}

function applyMessageUpdate(event: Record<string, unknown>): void {
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const assistantEventType = readString(assistantEvent?.type);
  if (assistantEventType?.startsWith("toolcall_")) {
    const toolName = readToolNameFromEvent(event) ?? "tool";
    const streamKey = resolveToolStreamKey(event, toolName);
    const statusText =
      assistantEventType === "toolcall_end"
        ? `工具 ${toolName} 调用完成`
        : `正在调用工具 ${toolName}`;
    setMessageText(streamKey, "tool", statusText, "replace");
    return;
  }

  const assistantText = extractAssistantText(event);
  if (assistantText) {
    const streamKey = resolveAssistantStreamKey(event);
    setMessageText(streamKey, "assistant", assistantText, "merge");
    return;
  }

  if (hasThinkingContent(asRecord(assistantEvent?.partial))) {
    const streamKey = resolveAssistantStreamKey(event);
    setMessageText(streamKey, "assistant", "思考中...", "replace");
  }
}

function applyMessageEnd(event: Record<string, unknown>): void {
  const message = asRecord(event.message);
  const role = readString(message?.role);
  if (role === "assistant") {
    const streamKey = resolveAssistantStreamKey(event);
    const finalText = extractMessageText(message);
    if (finalText) setMessageText(streamKey, "assistant", finalText, "replace");
    return;
  }
  if (role === "toolResult") {
    const toolName = readString(message?.toolName) ?? readToolNameFromEvent(event) ?? "tool";
    const streamKey = resolveToolResultKey(event, toolName);
    const toolText = extractMessageText(message);
    const finalText = toolText || `工具 ${toolName} 已返回结果`;
    setMessageText(streamKey, "tool", finalText, "replace");
  }
}

function applyToolExecutionEvent(event: Record<string, unknown>, eventType: string): void {
  const toolName = readString(event.toolName) ?? "tool";
  const key = `tool-exec:${toolName}`;
  if (eventType === "tool_execution_start") {
    setMessageText(key, "tool", `工具 ${toolName} 开始执行`, "replace");
    return;
  }
  if (eventType === "tool_execution_update") {
    setMessageText(key, "tool", `工具 ${toolName} 执行中`, "replace");
    return;
  }
  setMessageText(key, "tool", `工具 ${toolName} 执行完成`, "replace");
}

function ensureMessage(key: string, role: ChatRole): ChatMessageRefs {
  const existing = messagesByKey.get(key);
  if (existing) {
    if (existing.role !== role) {
      existing.role = role;
      existing.article.className = `chat-message role-${role}`;
      existing.roleLabel.textContent = roleLabel(role);
      if (role !== "tool") removeToolDetails(existing);
    }
    return existing;
  }

  const article = document.createElement("article");
  article.className = `chat-message role-${role}`;
  const roleTag = document.createElement("div");
  roleTag.className = "chat-role";
  roleTag.textContent = roleLabel(role);
  const content = document.createElement("p");
  content.className = "chat-content";
  article.append(roleTag, content);
  messageFeed.append(article);
  const created: ChatMessageRefs = { role, article, roleLabel: roleTag, content };
  messagesByKey.set(key, created);
  scrollToConversationBottom();
  return created;
}

function setMessageText(
  key: string,
  role: ChatRole,
  nextText: string,
  mode: "merge" | "replace",
): void {
  const state = ensureMessage(key, role);
  const currentText = messageTextByKey.get(key) ?? "";
  const resolvedText = mode === "merge" ? mergeMessageText(currentText, nextText) : nextText;
  if (resolvedText === currentText) return;
  messageTextByKey.set(key, resolvedText);
  renderMessageText(state, resolvedText);
  scrollToConversationBottom();
}

function renderMessageText(state: ChatMessageRefs, text: string): void {
  if (state.role === "tool" && shouldCollapseToolText(text)) {
    state.content.textContent = summarizeToolText(text);
    const details = ensureToolDetails(state);
    details.pre.textContent = text;
    return;
  }

  state.content.textContent = text;
  removeToolDetails(state);
}

function shouldCollapseToolText(text: string): boolean {
  if (text.length >= TOOL_COLLAPSE_MIN_LENGTH) return true;
  const lineBreakCount = text.split("\n").length - 1;
  return lineBreakCount >= 4;
}

function summarizeToolText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "工具输出";
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 80)}...`;
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

function appendTransientMessage(role: ChatRole, text: string): void {
  const key = nextLocalMessageKey(role);
  setMessageText(key, role, text, "replace");
}

function mergeMessageText(previous: string, incoming: string): string {
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  return `${previous}${incoming}`;
}

function applyQueryResultEvent(event: Record<string, unknown>): void {
  const command = readString(event.command);
  if (command !== "get_messages") return;
  const replace = event.replace === true;
  const messages = extractMessageArray(event.data);
  if (!messages || messages.length === 0) {
    if (replace) resetMessageFeed();
    return;
  }

  if (replace) resetMessageFeed();
  for (let index = 0; index < messages.length; index += 1) {
    const item = asRecord(messages[index]);
    if (!item) continue;
    hydrateHistoryMessage(item, index);
  }
}

function extractMessageArray(payload: unknown): unknown[] | undefined {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return undefined;
  if (Array.isArray(record.messages)) return record.messages;
  const nestedData = asRecord(record.data);
  if (Array.isArray(nestedData?.messages)) return nestedData.messages;
  return undefined;
}

function hydrateHistoryMessage(message: Record<string, unknown>, index: number): void {
  const role = readString(message.role);
  if (role === "user") {
    const text = extractMessageText(message);
    if (!text) return;
    const key = readString(message.id) ?? `history:user:${index}`;
    setMessageText(key, "user", text, "replace");
    return;
  }
  if (role === "assistant") {
    const text = extractMessageText(message);
    if (!text) return;
    const key =
      readString(message.responseId) ?? readString(message.id) ?? `history:assistant:${index}`;
    setMessageText(key, "assistant", text, "replace");
    return;
  }
  if (role === "toolResult") {
    const toolName = readString(message.toolName);
    const output = extractMessageText(message);
    const text = output
      ? toolName
        ? `${toolName}\n${output}`
        : output
      : `工具 ${toolName ?? "调用"} 输出`;
    const key = readString(message.toolCallId) ?? readString(message.id) ?? `history:tool:${index}`;
    setMessageText(key, "tool", text, "replace");
  }
}

function resetMessageFeed(): void {
  messagesByKey.clear();
  messageTextByKey.clear();
  messageFeed.replaceChildren();
}

function roleLabel(role: ChatRole): string {
  if (role === "user") return "你";
  if (role === "assistant") return "Pi";
  if (role === "tool") return "工具";
  return "错误";
}

function resolveAssistantStreamKey(event: Record<string, unknown>): string {
  const responseId = readResponseId(event);
  return responseId ? `assistant:${responseId}` : "assistant:active";
}

function resolveToolStreamKey(event: Record<string, unknown>, toolName: string): string {
  const responseId = readResponseId(event);
  if (responseId) return `tool:${responseId}:${toolName}`;
  const toolCallId = readToolCallIdFromEvent(event);
  if (toolCallId) return `tool:${toolCallId}`;
  return `tool:active:${toolName}`;
}

function resolveToolResultKey(event: Record<string, unknown>, toolName: string): string {
  const responseId = readResponseId(event);
  if (responseId) return `tool:${responseId}:${toolName}`;
  const message = asRecord(event.message);
  const toolCallId = readString(message?.toolCallId);
  if (toolCallId) return `tool:${toolCallId}`;
  return `tool:active:${toolName}`;
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
  const messageName = readString(message?.toolName);
  if (messageName) return messageName;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const partialName = readString(partial?.toolName);
  if (partialName) return partialName;
  return readToolNameFromContent(message?.content) ?? readToolNameFromContent(partial?.content);
}

function readToolNameFromContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "toolCall") continue;
    const name = readString(entry.name);
    if (name) return name;
  }
  return undefined;
}

function readToolCallIdFromEvent(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const direct = readString(message?.toolCallId);
  if (direct) return direct;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const fromPartial = readString(partial?.toolCallId);
  if (fromPartial) return fromPartial;
  return readToolCallIdFromContent(message?.content) ?? readToolCallIdFromContent(partial?.content);
}

function readToolCallIdFromContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "toolCall") continue;
    const id = readString(entry.id);
    if (id) return id;
  }
  return undefined;
}

function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const textFromMessage = extractMessageText(event.message);
  if (textFromMessage) return textFromMessage;
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const textFromPartial = extractMessageText(partial);
  if (textFromPartial) return textFromPartial;
  return readString(event.text);
}

function extractMessageText(message: unknown): string {
  const record = asRecord(message);
  if (!record) return "";
  const directText = readString(record.text);
  if (directText) return directText;
  const content = record.content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "text") continue;
    const text = readString(entry.text);
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}

function hasThinkingContent(message: Record<string, unknown> | undefined): boolean {
  if (!message) return false;
  const content = message.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => readString(asRecord(item)?.type) === "thinking");
}

function sendPrompt(): void {
  const text = promptInput.value.trim();
  if (!text) return;
  appendTransientMessage("user", text);
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

function scrollToConversationBottom(): void {
  messageFeed.scrollTop = messageFeed.scrollHeight;
}

function nextLocalMessageKey(prefix: string): string {
  localMessageSeq += 1;
  return `${prefix}:local:${localMessageSeq}`;
}
