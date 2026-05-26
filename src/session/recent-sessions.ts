import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";

const UNTITLED_SESSION = "无标题对话";
const DEFAULT_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

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

interface RecentSessionDependencies {
  homedir(): string;
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  stat(path: string): Promise<{ mtime: Date }>;
}

export interface RecentSessionsProvider {
  list(): Promise<RecentSessionSummary[]>;
}

export interface RecentSessionsProviderOptions {
  workspaceDir?: string;
  agentDir?: string;
}

export function createRecentSessionsProvider(
  options: RecentSessionsProviderOptions,
  dependencies: RecentSessionDependencies = {
    homedir,
    readdir,
    readFile,
    stat,
  },
): RecentSessionsProvider {
  return {
    async list() {
      const sessionDir = resolveWorkspaceSessionDir(options, dependencies);
      if (!sessionDir) return [];

      const sessionPaths = await readWorkspaceSessionPaths(sessionDir, dependencies);
      const summaries = await Promise.all(
        sessionPaths.map((sessionPath) => readRecentSessionSummary(sessionPath, dependencies)),
      );
      return summaries.sort(compareRecentSessions);
    },
  };
}

function resolveWorkspaceSessionDir(
  options: RecentSessionsProviderOptions,
  dependencies: Pick<RecentSessionDependencies, "homedir">,
): string | undefined {
  const workspaceDir = options.workspaceDir?.trim();
  if (!workspaceDir) return undefined;

  const agentDir = resolveAgentDir(options.agentDir, dependencies.homedir());
  return join(agentDir, "sessions", encodeWorkspaceDir(workspaceDir));
}

function resolveAgentDir(agentDir: string | undefined, homeDir: string): string {
  const explicitAgentDir = agentDir?.trim();
  if (explicitAgentDir) return explicitAgentDir;
  const envAgentDir = process.env[DEFAULT_AGENT_DIR_ENV]?.trim();
  if (envAgentDir) return envAgentDir;
  return join(homeDir, ".pi", "agent");
}

function encodeWorkspaceDir(workspaceDir: string): string {
  const normalized = workspaceDir.replace(/^[\\/]+/, "").replace(/[\\/:]/g, "-");
  return `--${normalized}--`;
}

async function readWorkspaceSessionPaths(
  sessionDir: string,
  dependencies: Pick<RecentSessionDependencies, "readdir">,
): Promise<string[]> {
  try {
    const names = await dependencies.readdir(sessionDir);
    return names.filter(isSessionFileName).map((name) => join(sessionDir, name));
  } catch {
    return [];
  }
}

function isSessionFileName(name: string): boolean {
  return name.endsWith(".jsonl");
}

async function readRecentSessionSummary(
  sessionPath: string,
  dependencies: Pick<RecentSessionDependencies, "readFile" | "stat">,
): Promise<RecentSessionSummary> {
  const stats = await dependencies.stat(sessionPath);
  const raw = await dependencies.readFile(sessionPath, "utf8").catch(() => "");
  const entries = parseSessionEntries(raw);

  let sessionId = fallbackSessionId(sessionPath);
  let latestSessionName: string | undefined;
  let firstUserMessage = "";
  let lastActivityTime: number | undefined;
  let headerTimestamp: number | undefined;

  for (const entry of entries) {
    if (entry.type === "session") {
      if (entry.id?.trim()) sessionId = entry.id.trim();
      const parsedHeaderTime = parseIsoTime(entry.timestamp);
      if (parsedHeaderTime !== undefined) {
        headerTimestamp = parsedHeaderTime;
      }
      continue;
    }

    if (entry.type === "session_info") {
      const trimmedName = entry.name?.trim();
      latestSessionName = trimmedName || undefined;
      continue;
    }

    if (entry.type !== "message" || !entry.message) {
      continue;
    }
    if (entry.message.role !== "user" && entry.message.role !== "assistant") {
      continue;
    }

    const messageTimestamp = readMessageTimestamp(entry);
    if (messageTimestamp !== undefined) {
      lastActivityTime = Math.max(lastActivityTime ?? 0, messageTimestamp);
    }

    const text = extractMessageText(entry.message.content);
    if (!text) continue;
    if (!firstUserMessage && entry.message.role === "user") {
      firstUserMessage = text;
    }
  }

  return {
    sessionId,
    sessionPath,
    title: latestSessionName || firstUserMessage || UNTITLED_SESSION,
    updatedAt: new Date(lastActivityTime ?? headerTimestamp ?? stats.mtime.getTime()).toISOString(),
  };
}

function fallbackSessionId(sessionPath: string): string {
  return basename(sessionPath, ".jsonl");
}

function parseSessionEntries(content: string): SessionEntry[] {
  const lines = content.trim().split("\n");
  const entries: SessionEntry[] = [];

  for (const line of lines) {
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

function parseIsoTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function extractMessageText(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .join(" ")
    .trim();
}

function compareRecentSessions(left: RecentSessionSummary, right: RecentSessionSummary): number {
  const timeDelta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  if (timeDelta !== 0) return timeDelta;
  return left.title.localeCompare(right.title, "zh-CN");
}
