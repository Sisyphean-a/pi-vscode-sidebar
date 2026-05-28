import { stripLeadingThinkingBlocks } from "../../ui/text.ts";

const TOOL_COLLAPSE_MIN_LENGTH = 180;

export type ChatRole = "user" | "assistant" | "tool" | "error";
export type MessageTextMode = "merge" | "replace";

interface ConversationFeedEntryState {
  role: ChatRole;
  text: string;
}

export interface ConversationFeedState {
  entries: Map<string, ConversationFeedEntryState>;
}

interface ApplyMessageTextOptions {
  fallbackKeys?: string[];
  key: string;
  mode: MessageTextMode;
  nextText: string;
  role: ChatRole;
}

interface PromoteEntryKeyResult {
  promotedFromKey?: string;
}

export interface ApplyMessageTextResult {
  changed: boolean;
  key: string;
  promotedFromKey?: string;
  role: ChatRole;
  text: string;
}

export function createConversationFeedState(): ConversationFeedState {
  return {
    entries: new Map<string, ConversationFeedEntryState>(),
  };
}

export function resetConversationFeedState(state: ConversationFeedState): void {
  state.entries.clear();
}

export function applyMessageText(
  state: ConversationFeedState,
  options: ApplyMessageTextOptions,
): ApplyMessageTextResult {
  const promotion = promoteEntryKey(state, options.key, options.fallbackKeys ?? []);
  const current = state.entries.get(options.key);
  const currentText = current?.text ?? "";
  const mergedText =
    options.mode === "merge" ? mergeMessageText(currentText, options.nextText) : options.nextText;
  const resolvedText =
    options.role === "assistant" ? stripLeadingThinkingBlocks(mergedText) : mergedText;

  if (!resolvedText && !current && !currentText) {
    return {
      changed: false,
      key: options.key,
      promotedFromKey: promotion.promotedFromKey,
      role: options.role,
      text: resolvedText,
    };
  }

  if (resolvedText === currentText) {
    return {
      changed: false,
      key: options.key,
      promotedFromKey: promotion.promotedFromKey,
      role: current?.role ?? options.role,
      text: resolvedText,
    };
  }

  state.entries.set(options.key, { role: options.role, text: resolvedText });
  return {
    changed: true,
    key: options.key,
    promotedFromKey: promotion.promotedFromKey,
    role: options.role,
    text: resolvedText,
  };
}

export function shouldCollapseToolText(text: string): boolean {
  if (text.length >= TOOL_COLLAPSE_MIN_LENGTH) return true;
  const lineBreakCount = text.split("\n").length - 1;
  return lineBreakCount >= 4;
}

export function summarizeToolText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "工具输出";
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 80)}...`;
}

function promoteEntryKey(
  state: ConversationFeedState,
  key: string,
  fallbackKeys: string[],
): PromoteEntryKeyResult {
  if (state.entries.has(key)) return {};
  for (const fallbackKey of fallbackKeys) {
    const entry = state.entries.get(fallbackKey);
    if (entry) {
      state.entries.set(key, entry);
      state.entries.delete(fallbackKey);
      return { promotedFromKey: fallbackKey };
    }
  }
  return {};
}

function mergeMessageText(previous: string, incoming: string): string {
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  return `${previous}${incoming}`;
}
