import { basename } from "node:path";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";

const UNTITLED_SESSION = "无标题对话";

interface SessionEntry {
  type?: string;
  id?: string;
  timestamp?: string;
  name?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type?: string; text?: string }>;
    timestamp?: number;
  };
}

interface ParseRecentSessionSummaryOptions {
  fallbackUpdatedAt: string;
  rawContent: string;
  sessionPath: string;
}

export function compareRecentSessions(
  left: RecentSessionSummary,
  right: RecentSessionSummary,
): number {
  const timeDelta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  if (timeDelta !== 0) return timeDelta;
  return left.title.localeCompare(right.title, "zh-CN");
}

export function parseRecentSessionSummary(
  options: ParseRecentSessionSummaryOptions,
): RecentSessionSummary {
  const entries = parseSessionEntries(options.rawContent);
  const summaryState = readSummaryState(entries, options.sessionPath);
  return {
    sessionId: summaryState.sessionId,
    sessionPath: options.sessionPath,
    title: summaryState.latestSessionName || summaryState.firstUserMessage || UNTITLED_SESSION,
    updatedAt: new Date(
      summaryState.lastActivityTime ??
        summaryState.headerTimestamp ??
        Date.parse(options.fallbackUpdatedAt),
    ).toISOString(),
  };
}

function extractMessageText(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .join(" ")
    .trim();
}

function fallbackSessionId(sessionPath: string): string {
  return basename(sessionPath, ".jsonl");
}

function parseIsoTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseSessionEntries(content: string): SessionEntry[] {
  const entries: SessionEntry[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as SessionEntry);
    } catch {
      continue;
    }
  }
  return entries;
}

function readMessageTimestamp(entry: SessionEntry): number | undefined {
  if (typeof entry.message?.timestamp === "number" && Number.isFinite(entry.message.timestamp)) {
    return entry.message.timestamp;
  }
  return parseIsoTime(entry.timestamp);
}

function readSummaryState(
  entries: SessionEntry[],
  sessionPath: string,
): {
  firstUserMessage: string;
  headerTimestamp: number | undefined;
  lastActivityTime: number | undefined;
  latestSessionName: string | undefined;
  sessionId: string;
} {
  const state = {
    firstUserMessage: "",
    headerTimestamp: undefined as number | undefined,
    lastActivityTime: undefined as number | undefined,
    latestSessionName: undefined as string | undefined,
    sessionId: fallbackSessionId(sessionPath),
  };
  for (const entry of entries) {
    if (entry.type === "session") {
      if (entry.id?.trim()) state.sessionId = entry.id.trim();
      const parsedHeaderTime = parseIsoTime(entry.timestamp);
      if (parsedHeaderTime !== undefined) state.headerTimestamp = parsedHeaderTime;
      continue;
    }
    if (entry.type === "session_info") {
      const trimmedName = entry.name?.trim();
      state.latestSessionName = trimmedName || undefined;
      continue;
    }
    if (entry.type !== "message" || !entry.message) continue;
    if (entry.message.role !== "user" && entry.message.role !== "assistant") continue;
    const messageTimestamp = readMessageTimestamp(entry);
    if (messageTimestamp !== undefined) {
      state.lastActivityTime = Math.max(state.lastActivityTime ?? 0, messageTimestamp);
    }
    const text = extractMessageText(entry.message.content);
    if (!text || state.firstUserMessage || entry.message.role !== "user") continue;
    state.firstUserMessage = text;
  }
  return state;
}
