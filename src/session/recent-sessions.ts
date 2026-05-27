import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RecentSessionSummary } from "../shared/recent-sessions.ts";
import { compareRecentSessions, parseRecentSessionSummary } from "./recent-sessions-summary.ts";

const DEFAULT_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

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
): Promise<ReturnType<typeof parseRecentSessionSummary>> {
  const stats = await dependencies.stat(sessionPath);
  const raw = await dependencies.readFile(sessionPath, "utf8").catch(() => "");
  return parseRecentSessionSummary({
    sessionPath,
    fallbackUpdatedAt: stats.mtime.toISOString(),
    rawContent: raw,
  });
}
