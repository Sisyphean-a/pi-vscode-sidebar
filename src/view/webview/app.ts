import { createActivityTranscript } from "./activity-transcript.ts";
import { resetComposerHeight, syncComposerHeight } from "./composer.ts";
import { createExtensionUiRenderer } from "./extension-ui.ts";
import { renderAssistantMarkdown, renderPlainTextWithReferences } from "./markdown.ts";
import { createRecentSessionsPanel } from "./recent-sessions.ts";
import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import type { HostToUiMessage } from "../protocol.ts";
import { SIDEBAR_TEMPLATE } from "./template.ts";
import { asRecord, readString, stringifyJson, truncateText } from "./ui-text.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

type ChatRole = "user" | "assistant" | "tool" | "error";

interface ChatMessageRefs {
  role: ChatRole;
  article: HTMLElement;
  content: HTMLElement;
  details?: HTMLDetailsElement;
  detailsSummary?: HTMLElement;
  detailsPre?: HTMLPreElement;
}

interface AvailableModel {
  provider: string;
  id: string;
  name?: string;
  contextWindow?: number;
  reasoning?: boolean;
  thinkingLevelMap?: ThinkingLevelMap;
}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type ThinkingLevelMap = Partial<Record<ThinkingLevel, string | null>>;

const THINKING_LEVEL_ORDER: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

const vscode = acquireVsCodeApi<object>();
const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

root.innerHTML = SIDEBAR_TEMPLATE;

const title = expectElement<HTMLElement>("title");
const modelSelect = expectElement<HTMLSelectElement>("model-select");
const promptInput = expectElement<HTMLTextAreaElement>("prompt-input");
const sendButton = expectElement<HTMLButtonElement>("send-button");
const newSessionButton = expectElement<HTMLButtonElement>("new-session-button");
const abortButton = expectElement<HTMLButtonElement>("abort-button");
const reconnectButton = expectElement<HTMLButtonElement>("reconnect-button");
const scrollToBottomButton = expectElement<HTMLButtonElement>("scroll-to-bottom-button");
const thinkingLevelSelect = expectElement<HTMLSelectElement>("thinking-level-select");
const extensionUiPanel = expectElement<HTMLElement>("extension-ui-panel");
const messageFeed = expectElement<HTMLElement>("message-feed");
const recentSessionsPanel = createRecentSessionsPanel({
  section: expectElement<HTMLElement>("recent-sessions-section"),
  preview: expectElement<HTMLElement>("recent-sessions-preview"),
  moreButton: expectElement<HTMLButtonElement>("recent-sessions-more-button"),
  overlay: expectElement<HTMLElement>("recent-sessions-overlay"),
  dialogTitle: expectElement<HTMLElement>("recent-sessions-dialog-title"),
  dialogList: expectElement<HTMLElement>("recent-sessions-dialog-list"),
  closeButton: expectElement<HTMLButtonElement>("recent-sessions-dialog-close"),
  onSelect(sessionPath) {
    postUiMessage({ type: "switch_session", sessionPath });
  },
});
const messagesByKey = new Map<string, ChatMessageRefs>();
const messageTextByKey = new Map<string, string>();
const activityTranscript = createActivityTranscript({
  container: messageFeed,
  onChange() {
    scrollToConversationBottom();
  },
});
const availableModelsByValue = new Map<string, AvailableModel>();
const availableModelValues: string[] = [];
const modelLabelByValue = new Map<string, string>();
const activityGroupByToolCallId = new Map<string, string>();
const toolArgsByToolCallId = new Map<string, string>();
const TOOL_COLLAPSE_MIN_LENGTH = 180;
const ACTIVE_ASSISTANT_MESSAGE_KEY = "assistant:active";
const ACTIVE_ASSISTANT_ACTIVITY_KEY = "assistant-activity:live";
const ACTIVE_THINKING_ACTIVITY_KEY = "assistant-thinking:live";
let bootingNoticeResolved = false;
let localMessageSeq = 0;
let currentModelValue = "";
let lastRpcModelValue = "";
let lastRpcThinkingLevel = "";
let hasRequestedModels = false;
let modelOptionsLoaded = false;
let pendingModelValue = "";
let pendingThinkingLevel = "";
let suppressModelSelectChange = false;
let isStreamingPhase = false;
let shouldAutoScroll = true;

resetComposerHeight(promptInput);

const renderExtensionUiRequest = createExtensionUiRenderer({
  panel: extensionUiPanel,
  escapeHtml(text) {
    return text;
  },
  expectElement,
  postResponse(requestId, payload) {
    postUiMessage({ type: "respond_extension_ui", requestId, payload });
  },
  updateStatus(statusKey, statusText) {
    updateConnectionTitle(statusKey, statusText);
  },
  updateTitle(nextTitle) {
    if (nextTitle.trim()) {
      title.textContent = nextTitle;
    }
  },
  setEditorText(text) {
    promptInput.value = text;
    promptInput.focus();
  },
  queueNotice(message) {
    appendInlineNote(message);
  },
});

sendButton.addEventListener("click", () => {
  if (isStreamingPhase) {
    postUiMessage({ type: "abort" });
    return;
  }
  sendPrompt();
});
promptInput.addEventListener("input", () => {
  syncComposerHeight(promptInput);
});
messageFeed.addEventListener("click", (event) => {
  handleMessageFeedClick(event);
});
messageFeed.addEventListener("scroll", () => {
  handleMessageFeedScroll();
});
scrollToBottomButton.addEventListener("click", () => {
  shouldAutoScroll = true;
  scrollToConversationBottom(true);
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
  pendingThinkingLevel = level;
  postUiMessage({ type: "set_thinking_level", level });
});
modelSelect.addEventListener("change", () => {
  if (suppressModelSelectChange) return;
  const model = availableModelsByValue.get(modelSelect.value);
  if (!model) return;
  pendingModelValue = formatModelValue(model);
  appendInlineNote(`已请求切换模型到 ${formatModelValue(model)}`);
  postUiMessage({ type: "set_model", provider: model.provider, modelId: model.id });
});

window.addEventListener("message", (event: MessageEvent<HostToUiMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object" || !("type" in message)) return;

  if (message.type === "notice") {
    updateConnectionTitle("connected", message.message);
    return;
  }
  if (message.type === "error") {
    resolveBootingNotice("process_dead");
    if (pendingThinkingLevel) {
      pendingThinkingLevel = "";
      if (lastRpcThinkingLevel) thinkingLevelSelect.value = lastRpcThinkingLevel;
    }
    if (pendingModelValue) {
      pendingModelValue = "";
      currentModelValue = lastRpcModelValue;
      renderModelSelect();
    }
    appendTransientMessage("error", message.message);
    return;
  }
  if (message.type === "event") {
    resolveBootingNotice("idle");
    applyAgentEvent(message.data);
    return;
  }
  if (message.type === "insert_prompt_reference") {
    insertPromptReference(message.data);
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
requestAvailableModels();

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}

function updateState(data: Record<string, unknown>): void {
  const view = asRecord(data.view);
  const rpc = asRecord(data.rpc);
  const phase = readString(view?.phase) ?? "idle";
  resolveBootingNotice(phase);
  updateConnectionTitle(phase);
  syncStreamingPhase(phase);
  reconnectButton.classList.toggle("hidden", phase !== "process_dead");
  syncModelSelection(rpc);
  syncThinkingLevel(rpc);
  if (Array.isArray(data.recentSessions)) {
    recentSessionsPanel.update(
      data.recentSessions as RecentSessionSummary[],
      readString(rpc?.sessionFile),
    );
  }
  if (!modelOptionsLoaded) requestAvailableModels();
}

function resolveBootingNotice(phase: string): void {
  if (bootingNoticeResolved) return;
  updateConnectionTitle(phase);
  bootingNoticeResolved = true;
}

function syncThinkingLevel(rpc: Record<string, unknown> | undefined): void {
  const nextLevel = readString(rpc?.thinkingLevel);
  if (!nextLevel) return;
  lastRpcThinkingLevel = nextLevel;
  renderThinkingLevelSelect(pendingThinkingLevel || nextLevel);
  if (pendingThinkingLevel && nextLevel !== pendingThinkingLevel) return;
  pendingThinkingLevel = "";
  if (hasThinkingLevelOption(nextLevel)) thinkingLevelSelect.value = nextLevel;
}

function syncModelSelection(rpc: Record<string, unknown> | undefined): void {
  if (!rpc || !Object.hasOwn(rpc, "model")) return;
  const modelRecord = asRecord(rpc?.model);
  const provider = readString(modelRecord?.provider);
  const modelId = readString(modelRecord?.id);
  currentModelValue = provider && modelId ? formatModelValue({ provider, id: modelId }) : "";
  lastRpcModelValue = currentModelValue;
  if (pendingModelValue && currentModelValue !== pendingModelValue) return;
  pendingModelValue = "";
  renderModelSelect();
}

function applyAgentEvent(data: unknown): void {
  const event = asRecord(data);
  const type = readString(event?.type);
  if (!event || !type) return;

  if (type === "thinking_level_changed") {
    syncThinkingLevel({ thinkingLevel: event.level });
    return;
  }
  if (type === "query_result") {
    applyQueryResultEvent(event);
    return;
  }
  if (type === "rpc_command_sent" || type === "rpc_response") return;
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
  if (role === "assistant") return;
}

function applyMessageUpdate(event: Record<string, unknown>): void {
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const assistantEventType = readString(assistantEvent?.type);
  if (assistantEventType?.startsWith("toolcall_")) {
    finalizeThinkingActivity(event);
    const toolName = readToolNameFromEvent(event) ?? "tool";
    const toolArgs = readToolArgsFromEvent(event);
    const groupKey = resolveAssistantActivityGroupKey(event);
    const entryKey = resolveToolEntryKey(event, toolName);
    rememberToolActivityGroup(event, groupKey);
    rememberToolArgs(event, toolArgs);
    activityTranscript.record({
      groupKey,
      entryKey,
      status: "running",
      label: summarizeToolLabel(toolName, toolArgs),
      detail: toolArgs,
      detailSummary: summarizeToolDetailSummary(toolName, toolArgs),
      family: resolveToolFamily(toolName),
    });
    return;
  }
  if (assistantEventType?.startsWith("thinking_")) {
    const thinkingText = extractThinkingText(event);
    if (!thinkingText) return;
    activityTranscript.record({
      groupKey: resolveThinkingActivityGroupKey(event),
      entryKey: resolveThinkingEntryKey(event),
      status: assistantEventType === "thinking_end" ? "done" : "running",
      label: `思考：${thinkingText}`,
      family: "thinking",
    });
    return;
  }

  const assistantText = extractAssistantText(event);
  if (assistantText) {
    finalizeThinkingActivity(event);
    const streamKey = resolveAssistantStreamKey(event);
    setMessageText(streamKey, "assistant", assistantText, "merge", [ACTIVE_ASSISTANT_MESSAGE_KEY]);
    return;
  }
}

function applyMessageEnd(event: Record<string, unknown>): void {
  const message = asRecord(event.message);
  const role = readString(message?.role);
  if (role === "assistant") {
    finalizeThinkingActivity(event);
    const streamKey = resolveAssistantStreamKey(event);
    const finalText = extractMessageText(message);
    if (finalText) {
      setMessageText(streamKey, "assistant", finalText, "replace", [ACTIVE_ASSISTANT_MESSAGE_KEY]);
    }
    activityTranscript.finalizeGroup(resolveAssistantActivityGroupKey(event));
    return;
  }
  if (role === "toolResult") {
    const toolName = readString(message?.toolName) ?? readToolNameFromEvent(event) ?? "tool";
    const toolText = extractMessageText(message);
    const toolArgs = readToolArgsFromEvent(event) ?? readStoredToolArgs(message);
    const groupKey = resolveToolActivityGroupKey(event);
    const liveEntryKey = resolveToolEntryKey(event, toolName);
    const finalEntryKey = resolveToolResultEntryKey(message, toolName);
    activityTranscript.renameEntry(groupKey, liveEntryKey, finalEntryKey);
    activityTranscript.record({
      groupKey,
      entryKey: finalEntryKey,
      status: "done",
      label: summarizeToolLabel(toolName, toolArgs, toolText),
      detail: toolText || undefined,
      detailSummary: summarizeToolResultDetailSummary(toolName, toolText),
      family: resolveToolFamily(toolName),
    });
  }
}

function finalizeThinkingActivity(event: Record<string, unknown>): void {
  activityTranscript.finalizeGroup(resolveThinkingActivityGroupKey(event));
}

function applyToolExecutionEvent(event: Record<string, unknown>, eventType: string): void {
  const toolName = readString(event.toolName) ?? "tool";
  const groupKey = resolveToolActivityGroupKey(event);
  const entryKey = resolveToolEntryKey(event, toolName);
  const toolArgs = readToolArgsFromExecutionEvent(event);
  const toolText = extractToolExecutionText(event);
  rememberToolActivityGroup(event, groupKey);
  rememberToolArgs(event, toolArgs);
  activityTranscript.record({
    groupKey,
    entryKey,
    status: eventType === "tool_execution_end" ? "done" : "running",
    label: summarizeToolLabel(toolName, toolArgs, toolText),
    detail: toolText,
    detailSummary: toolText
      ? summarizeToolResultDetailSummary(toolName, toolText)
      : summarizeToolDetailSummary(toolName, toolArgs),
    family: resolveToolFamily(toolName),
  });
}

function ensureMessage(key: string, role: ChatRole): ChatMessageRefs {
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
  messageFeed.append(article);
  const created: ChatMessageRefs = { role, article, content };
  messagesByKey.set(key, created);
  scrollToConversationBottom();
  return created;
}

function setMessageText(
  key: string,
  role: ChatRole,
  nextText: string,
  mode: "merge" | "replace",
  fallbackKeys: string[] = [],
): void {
  promoteMessageKey(key, fallbackKeys);
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

  if (state.role === "assistant") {
    state.content.replaceChildren(renderAssistantMarkdown(text));
    removeToolDetails(state);
    return;
  }

  if (state.role === "user" || state.role === "error") {
    state.content.replaceChildren(renderPlainTextWithReferences(text));
    removeToolDetails(state);
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
  if (command === "get_available_models") {
    applyAvailableModelsQueryResult(event);
    return;
  }
  if (command === "set_thinking_level") {
    applyThinkingLevelCommandResult();
    return;
  }
  if (command === "set_model") {
    applyModelCommandResult();
    return;
  }
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
    hydrateHistoryAssistantMessage(message, index);
    return;
  }
  if (role === "toolResult") {
    const toolName = readString(message.toolName);
    const output = extractMessageText(message);
    const groupKey = `history:tool-group:${index}`;
    const key = readString(message.toolCallId) ?? readString(message.id) ?? `history:tool:${index}`;
    activityTranscript.record({
      groupKey,
      entryKey: key,
      status: "done",
      label: summarizeToolLabel(toolName ?? "tool", undefined, output),
      detail: output || undefined,
      detailSummary: summarizeToolResultDetailSummary(toolName ?? "tool", output),
      family: resolveToolFamily(toolName ?? "tool"),
    });
    activityTranscript.finalizeGroup(groupKey);
  }
}

function hydrateHistoryAssistantMessage(message: Record<string, unknown>, index: number): void {
  const responseId = readString(message.responseId) ?? readString(message.id);
  const thinkingText = extractThinkingTextFromMessage(message);
  if (thinkingText) {
    const groupKey = responseId ? `history:thinking:${responseId}` : `history:thinking:${index}`;
    const entryKey = responseId ? `${responseId}:thinking` : `history:thinking-entry:${index}`;
    activityTranscript.record({
      groupKey,
      entryKey,
      status: "done",
      label: `思考：${thinkingText}`,
      family: "thinking",
    });
    activityTranscript.finalizeGroup(groupKey);
  }

  const text = extractMessageText(message);
  if (!text) return;
  const key = responseId ?? `history:assistant:${index}`;
  setMessageText(key, "assistant", text, "replace");
}

function resetMessageFeed(): void {
  messagesByKey.clear();
  messageTextByKey.clear();
  activityGroupByToolCallId.clear();
  toolArgsByToolCallId.clear();
  messageFeed.replaceChildren();
  activityTranscript.reset();
  shouldAutoScroll = true;
  updateScrollToBottomButton();
}

function resolveAssistantStreamKey(event: Record<string, unknown>): string {
  const responseId = readResponseId(event);
  return responseId ? `assistant:${responseId}` : ACTIVE_ASSISTANT_MESSAGE_KEY;
}

function readResponseId(event: Record<string, unknown>): string | undefined {
  const direct = readString(event.responseId);
  if (direct) return direct;
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

function extractThinkingText(event: Record<string, unknown>): string | undefined {
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  const textFromPartial = extractThinkingTextFromMessage(partial);
  if (textFromPartial) return textFromPartial;
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const deltaText = readString(assistantEvent?.delta);
  if (deltaText) return deltaText;
  const endContent = readString(assistantEvent?.content);
  if (endContent) return endContent;
  const textFromMessage = extractThinkingTextFromMessage(event.message);
  if (textFromMessage) return textFromMessage;
  return undefined;
}

function extractThinkingTextFromMessage(message: unknown): string | undefined {
  const record = asRecord(message);
  if (!record) return undefined;
  const content = record.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "thinking") continue;
    const thinking = readString(entry.thinking);
    if (thinking) return thinking;
  }
  return undefined;
}

function applyAvailableModelsQueryResult(event: Record<string, unknown>): void {
  const models = extractAvailableModels(event.data);
  if (!models) return;
  availableModelsByValue.clear();
  availableModelValues.length = 0;
  modelLabelByValue.clear();
  for (const model of models) {
    const value = formatModelValue(model);
    availableModelsByValue.set(value, model);
    availableModelValues.push(value);
  }
  availableModelValues.sort();
  for (const value of availableModelValues) {
    const model = availableModelsByValue.get(value);
    if (!model) continue;
    modelLabelByValue.set(value, buildModelSelectLabel(model));
  }
  modelOptionsLoaded = true;
  renderModelSelect();
}

function renderModelSelect(): void {
  suppressModelSelectChange = true;
  modelSelect.replaceChildren();

  if (!modelOptionsLoaded) {
    appendModelOption(
      currentModelValue ? formatLooseModelLabel(currentModelValue) : "加载中",
      currentModelValue,
    );
    modelSelect.disabled = true;
    suppressModelSelectChange = false;
    return;
  }

  if (availableModelValues.length === 0) {
    appendModelOption(
      currentModelValue ? formatLooseModelLabel(currentModelValue) : "无可用模型",
      currentModelValue,
    );
    modelSelect.disabled = true;
    suppressModelSelectChange = false;
    return;
  }

  if (!currentModelValue) {
    appendModelOption("模型", "");
  } else if (!availableModelsByValue.has(currentModelValue)) {
    appendModelOption(formatLooseModelLabel(currentModelValue), currentModelValue);
  }

  for (const value of availableModelValues) {
    appendModelOption(modelLabelByValue.get(value) ?? formatLooseModelLabel(value), value);
  }

  modelSelect.value =
    currentModelValue && hasModelOption(currentModelValue) ? currentModelValue : "";
  modelSelect.disabled = false;
  suppressModelSelectChange = false;
  renderThinkingLevelSelect(
    pendingThinkingLevel || lastRpcThinkingLevel || thinkingLevelSelect.value,
  );
}

function appendModelOption(label: string, value: string): void {
  modelSelect.append(new Option(label, value));
}

function hasModelOption(value: string): boolean {
  return Array.from(modelSelect.options).some((option) => option.value === value);
}

function extractAvailableModels(data: unknown): AvailableModel[] | undefined {
  const payload = asRecord(data);
  const models = Array.isArray(payload?.models)
    ? payload.models
    : Array.isArray(asRecord(payload?.data)?.models)
      ? (asRecord(payload?.data)?.models as unknown[])
      : undefined;
  if (!models) return undefined;
  const available: AvailableModel[] = [];
  for (const entry of models) {
    const model = asRecord(entry);
    const provider = readString(model?.provider);
    const id = readString(model?.id);
    if (!provider || !id) continue;
    const name = readString(model?.name);
    const contextWindow =
      typeof model?.contextWindow === "number" ? model.contextWindow : undefined;
    const reasoning = model?.reasoning === true;
    const thinkingLevelMap = extractThinkingLevelMap(model?.thinkingLevelMap);
    available.push({
      provider,
      id,
      name,
      contextWindow,
      reasoning,
      thinkingLevelMap,
    });
  }
  return available;
}

function extractThinkingLevelMap(value: unknown): ThinkingLevelMap | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const thinkingLevelMap: ThinkingLevelMap = {};
  let hasEntry = false;
  for (const level of THINKING_LEVEL_ORDER) {
    const entry = record[level];
    if (entry === null) {
      thinkingLevelMap[level] = null;
      hasEntry = true;
      continue;
    }
    const mapped = readString(entry);
    if (!mapped) continue;
    thinkingLevelMap[level] = mapped;
    hasEntry = true;
  }
  return hasEntry ? thinkingLevelMap : undefined;
}

function formatModelValue(model: Pick<AvailableModel, "provider" | "id">): string {
  return `${model.provider}/${model.id}`;
}

function buildModelSelectLabel(model: AvailableModel): string {
  const compact = compactModelName(model.name ?? model.id);
  const duplicateCount = availableModelValues.filter((value) => {
    const available = availableModelsByValue.get(value);
    if (!available) return false;
    return compactModelName(available.name ?? available.id) === compact;
  }).length;
  if (duplicateCount > 1) return `${model.provider} ${compact}`;
  return compact;
}

function formatLooseModelLabel(modelValue: string): string {
  const [, rawModelId = modelValue] = modelValue.split("/", 2);
  return compactModelName(rawModelId);
}

function compactModelName(name: string): string {
  const trimmed = name.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("gpt-")) {
    return trimmed.slice(4).replace(/-/g, " ");
  }
  if (lowered.startsWith("claude-")) {
    return trimmed.slice(7).replace(/-/g, " ");
  }
  if (lowered.startsWith("gemini-")) {
    return trimmed.slice(7).replace(/-/g, " ");
  }
  return trimmed;
}

function requestAvailableModels(): void {
  if (hasRequestedModels) return;
  hasRequestedModels = true;
  postUiMessage({ type: "get_available_models" });
}

function renderThinkingLevelSelect(preferredLevel: string): void {
  const supportedLevels = getSupportedThinkingLevels();
  const nextValue = clampThinkingLevel(supportedLevels, preferredLevel);
  thinkingLevelSelect.replaceChildren(
    ...supportedLevels.map((level) => new Option(formatThinkingLevelLabel(level), level)),
  );
  thinkingLevelSelect.disabled = supportedLevels.length <= 1;
  thinkingLevelSelect.value = nextValue;
}

function getSupportedThinkingLevels(): ThinkingLevel[] {
  const model = resolveActiveModelForThinking();
  if (!model) return [...THINKING_LEVEL_ORDER];
  if (!model.reasoning) return ["off"];
  return THINKING_LEVEL_ORDER.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null) return false;
    if (level === "xhigh") return mapped !== undefined;
    return true;
  });
}

function resolveActiveModelForThinking(): AvailableModel | undefined {
  const modelValue = pendingModelValue || currentModelValue || modelSelect.value;
  if (!modelValue) return undefined;
  return availableModelsByValue.get(modelValue);
}

function clampThinkingLevel(
  supportedLevels: ThinkingLevel[],
  preferredLevel: string,
): ThinkingLevel {
  const fallbackLevel = supportedLevels[0] ?? "off";
  if (supportedLevels.length === 0) return fallbackLevel;
  if (supportedLevels.includes(preferredLevel as ThinkingLevel)) {
    return preferredLevel as ThinkingLevel;
  }
  const requestedIndex = THINKING_LEVEL_ORDER.indexOf(preferredLevel as ThinkingLevel);
  if (requestedIndex === -1) return fallbackLevel;
  for (let index = requestedIndex; index < THINKING_LEVEL_ORDER.length; index += 1) {
    const candidate = THINKING_LEVEL_ORDER[index];
    if (!candidate) continue;
    if (supportedLevels.includes(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = THINKING_LEVEL_ORDER[index];
    if (!candidate) continue;
    if (supportedLevels.includes(candidate)) return candidate;
  }
  return fallbackLevel;
}

function hasThinkingLevelOption(level: string): boolean {
  return Array.from(thinkingLevelSelect.options).some((option) => option.value === level);
}

function appendInlineNote(message: string): void {
  activityTranscript.appendNote(nextLocalActivityKey("note"), message);
}

function nextLocalActivityKey(prefix: string): string {
  localMessageSeq += 1;
  return `${prefix}:${localMessageSeq}`;
}

function resolveAssistantActivityGroupKey(event: Record<string, unknown>): string {
  const responseId = readResponseId(event);
  if (!responseId) return ACTIVE_ASSISTANT_ACTIVITY_KEY;
  const key = `assistant-activity:${responseId}`;
  activityTranscript.renameGroup(ACTIVE_ASSISTANT_ACTIVITY_KEY, key);
  return key;
}

function resolveToolEntryKey(event: Record<string, unknown>, toolName: string): string {
  const toolCallId = readToolCallIdFromEvent(event);
  if (toolCallId) return toolCallId;
  const responseId = readResponseId(event);
  return responseId ? `${responseId}:${toolName}` : `live:${toolName}`;
}

function resolveToolResultEntryKey(
  message: Record<string, unknown> | undefined,
  toolName: string,
): string {
  const toolCallId = readString(message?.toolCallId);
  if (toolCallId) return toolCallId;
  return `done:${toolName}`;
}

function applyThinkingLevelCommandResult(): void {
  if (!pendingThinkingLevel) return;
  const requested = pendingThinkingLevel;
  pendingThinkingLevel = "";
  const resolved = lastRpcThinkingLevel || requested;
  if (thinkingLevelSelect.value !== resolved) {
    thinkingLevelSelect.value = resolved;
  }
  if (resolved !== requested) {
    appendInlineNote(
      `当前模型暂不支持${formatThinkingLevelLabel(requested)}，已保持${formatThinkingLevelLabel(resolved)}`,
    );
  }
}

function applyModelCommandResult(): void {
  if (!pendingModelValue) return;
  const requested = pendingModelValue;
  pendingModelValue = "";
  currentModelValue = lastRpcModelValue || currentModelValue;
  renderModelSelect();
  if (currentModelValue && currentModelValue !== requested) {
    appendInlineNote(`模型切换未生效，当前仍为 ${currentModelValue}`);
  }
}

function readToolArgsFromEvent(event: Record<string, unknown>): string | undefined {
  const message = asRecord(event.message);
  const partial = asRecord(asRecord(event.assistantMessageEvent)?.partial);
  return readToolArgsFromContent(message?.content) ?? readToolArgsFromContent(partial?.content);
}

function readToolArgsFromExecutionEvent(event: Record<string, unknown>): string | undefined {
  if (event.args && typeof event.args === "object") return stringifyJson(event.args);
  return undefined;
}

function readToolCallIdFromEvent(event: Record<string, unknown>): string | undefined {
  const directFromEvent = readString(event.toolCallId);
  if (directFromEvent) return directFromEvent;
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

function readToolArgsFromContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    const entry = asRecord(item);
    if (!entry || readString(entry.type) !== "toolCall") continue;
    const args = readString(entry.args) ?? readString(entry.partialArgs);
    if (args) return args;
    if (entry.args && typeof entry.args === "object") return stringifyJson(entry.args);
  }
  return undefined;
}

function summarizeToolLabel(
  toolName: string,
  argsText: string | undefined,
  outputText?: string,
): string {
  const path = readNamedArg(argsText, "path") ?? readNamedArg(argsText, "filePath");
  const workdir =
    readNamedArg(argsText, "cwd") ??
    readNamedArg(argsText, "workdir") ??
    readNamedArg(argsText, "workingDirectory");
  const command = readNamedArg(argsText, "cmd") ?? readNamedArg(argsText, "command");
  const query =
    readNamedArg(argsText, "q") ??
    readNamedArg(argsText, "query") ??
    readNamedArg(argsText, "pattern");

  if (toolName === "read") return path ? `读取：${truncateText(path, 72)}` : "读取文件";
  if (toolName === "apply_patch") return "apply_patch";
  if (toolName === "exec_command") {
    if (workdir) return `bash：${truncateText(workdir, 72)}`;
    if (command) return `bash：${truncateText(command, 72)}`;
    const firstLine = readFirstNonEmptyLine(outputText);
    if (firstLine) return `bash：${truncateText(firstLine, 72)}`;
    return "bash";
  }
  if (toolName === "rg" || toolName === "grep" || toolName === "search") {
    return query ? `搜索：${truncateText(query, 72)}` : "搜索代码";
  }
  if (toolName === "open") return path ? `打开：${truncateText(path, 72)}` : "打开内容";
  if (toolName.includes("write") || toolName.includes("edit")) {
    return path ? `修改：${truncateText(path, 72)}` : `修改内容（${toolName}）`;
  }
  return toolName;
}

function summarizeToolDetailSummary(toolName: string, argsText: string | undefined): string {
  if (toolName === "exec_command") {
    const command = readNamedArg(argsText, "cmd") ?? readNamedArg(argsText, "command");
    return command ? `查看 ${command} 参数` : "查看命令参数";
  }
  return "查看参数";
}

function summarizeToolResultDetailSummary(toolName: string, output: string): string {
  if (toolName === "exec_command") return "查看命令输出";
  if (!output.trim()) return "查看结果";
  return "查看详情";
}

function readNamedArg(argsText: string | undefined, name: string): string | undefined {
  if (!argsText) return undefined;
  const matcher = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`);
  const quoted = argsText.match(matcher)?.[1];
  if (quoted) return quoted;
  const plain = argsText.match(new RegExp(`"${name}"\\s*:\\s*([^,}\\]]+)`))?.[1]?.trim();
  return plain?.replace(/^"|"$/g, "");
}

function resolveToolFamily(toolName: string): string {
  if (toolName === "exec_command") return "command";
  if (toolName.startsWith("codegraph_")) return "codegraph";
  if (
    toolName === "search_query" ||
    toolName === "image_query" ||
    toolName === "open" ||
    toolName === "click" ||
    toolName === "find"
  ) {
    return "web";
  }
  return "tool";
}

function readFirstNonEmptyLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}

function rememberToolActivityGroup(event: Record<string, unknown>, groupKey: string): void {
  const toolCallId = readToolCallIdFromEvent(event);
  if (!toolCallId) return;
  activityGroupByToolCallId.set(toolCallId, groupKey);
}

function rememberToolArgs(event: Record<string, unknown>, toolArgs: string | undefined): void {
  if (!toolArgs) return;
  const toolCallId = readToolCallIdFromEvent(event);
  if (!toolCallId) return;
  toolArgsByToolCallId.set(toolCallId, toolArgs);
}

function readStoredToolArgs(message: Record<string, unknown> | undefined): string | undefined {
  const toolCallId = readString(message?.toolCallId);
  if (!toolCallId) return undefined;
  return toolArgsByToolCallId.get(toolCallId);
}

function resolveToolActivityGroupKey(event: Record<string, unknown>): string {
  const toolCallId = readToolCallIdFromEvent(event);
  if (toolCallId) {
    const mappedKey = activityGroupByToolCallId.get(toolCallId);
    if (mappedKey) return mappedKey;
  }
  return resolveAssistantActivityGroupKey(event);
}

function resolveThinkingActivityGroupKey(event: Record<string, unknown>): string {
  const responseId = readResponseId(event);
  if (!responseId) return ACTIVE_THINKING_ACTIVITY_KEY;
  const key = `assistant-thinking:${responseId}`;
  activityTranscript.renameGroup(ACTIVE_THINKING_ACTIVITY_KEY, key);
  return key;
}

function resolveThinkingEntryKey(event: Record<string, unknown>): string {
  const responseId = readResponseId(event);
  return responseId ? `${responseId}:thinking` : "live:thinking";
}

function extractToolExecutionText(event: Record<string, unknown>): string | undefined {
  const partialResult = asRecord(event.partialResult);
  const result = asRecord(event.result);
  const partialText = extractMessageText(partialResult);
  if (partialText) return partialText;
  const resultText = extractMessageText(result);
  return resultText || undefined;
}

function formatThinkingLevelLabel(level: string): string {
  if (level === "off") return "关闭";
  if (level === "minimal") return "极低";
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  if (level === "xhigh") return "超高";
  return level;
}

function promoteMessageKey(key: string, fallbackKeys: string[]): void {
  if (messagesByKey.has(key)) return;
  for (const fallbackKey of fallbackKeys) {
    if (fallbackKey === key) continue;
    const state = messagesByKey.get(fallbackKey);
    if (!state) continue;
    messagesByKey.set(key, state);
    messagesByKey.delete(fallbackKey);

    const text = messageTextByKey.get(fallbackKey);
    if (text !== undefined) {
      messageTextByKey.set(key, text);
      messageTextByKey.delete(fallbackKey);
    }
    return;
  }
}

function sendPrompt(): void {
  const text = promptInput.value.trim();
  if (!text) return;
  appendTransientMessage("user", text);
  postUiMessage({ type: "send_prompt", text });
  promptInput.value = "";
  resetComposerHeight(promptInput);
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

function scrollToConversationBottom(force = false): void {
  if (!force && !shouldAutoScroll) {
    updateScrollToBottomButton();
    return;
  }
  messageFeed.scrollTop = messageFeed.scrollHeight;
  updateScrollToBottomButton();
}

function syncStreamingPhase(phase: string): void {
  isStreamingPhase = phase === "streaming";
  sendButton.textContent = isStreamingPhase ? "停止" : "发送";
  sendButton.title = isStreamingPhase ? "停止生成" : "发送消息";
}

function updateConnectionTitle(statusKey: string, statusText?: string): void {
  if (statusText?.trim()) {
    title.textContent = statusText;
    return;
  }

  title.textContent = statusKey === "process_dead" ? "未连接Pi" : "已连接";
}

function insertPromptReference(payload: unknown): void {
  const data = asRecord(payload);
  const reference = readString(data?.reference);
  if (!reference) {
    return;
  }

  insertTextAtSelection(buildPromptReferenceInsertion(reference));
  promptInput.focus();
}

function insertTextAtSelection(text: string): void {
  const start = promptInput.selectionStart ?? promptInput.value.length;
  const end = promptInput.selectionEnd ?? promptInput.value.length;
  promptInput.value = `${promptInput.value.slice(0, start)}${text}${promptInput.value.slice(end)}`;
  const nextCursor = start + text.length;
  promptInput.selectionStart = nextCursor;
  promptInput.selectionEnd = nextCursor;
  syncComposerHeight(promptInput);
}

function buildPromptReferenceInsertion(reference: string): string {
  const start = promptInput.selectionStart ?? promptInput.value.length;
  const end = promptInput.selectionEnd ?? promptInput.value.length;
  const before = promptInput.value.slice(0, start);
  const after = promptInput.value.slice(end);
  const prefix = shouldInsertLeadingSpace(before) ? " " : "";
  const suffix = shouldInsertTrailingSpace(after) ? " " : "";
  return `${prefix}${reference}${suffix}`;
}

function shouldInsertLeadingSpace(text: string): boolean {
  if (!text) return false;
  return !/\s$/.test(text);
}

function shouldInsertTrailingSpace(text: string): boolean {
  if (!text) return true;
  return !/^\s/.test(text);
}

function handleMessageFeedScroll(): void {
  shouldAutoScroll = isNearBottom();
  updateScrollToBottomButton();
}

function handleMessageFeedClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const reference = target.closest(".file-reference-chip");
  if (!(reference instanceof HTMLButtonElement)) {
    return;
  }

  const path = reference.dataset.path;
  const startLine = Number(reference.dataset.startLine);
  const endLine = reference.dataset.endLine ? Number(reference.dataset.endLine) : undefined;
  if (!path || !Number.isFinite(startLine)) {
    return;
  }

  postUiMessage({
    type: "open_file_reference",
    path,
    startLine,
    endLine,
  });
}

function updateScrollToBottomButton(): void {
  scrollToBottomButton.classList.toggle("hidden", !isStreamingPhase || shouldAutoScroll);
}

function isNearBottom(): boolean {
  return messageFeed.scrollHeight - messageFeed.scrollTop - messageFeed.clientHeight <= 16;
}

function nextLocalMessageKey(prefix: string): string {
  localMessageSeq += 1;
  return `${prefix}:local:${localMessageSeq}`;
}
