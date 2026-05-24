import { existsSync } from "node:fs";

const SESSIONS_KEY = "piSidebar.sessions";

export type SessionMap = Record<string, string>;

export interface SessionTracker {
  read(): SessionMap;
  update(sessionId: string, sessionFile: string): Promise<void>;
  remove(sessionId: string): Promise<void>;
  pruneMissingSessions(): Promise<SessionMap>;
}

export function createSessionTracker(
  context: {
    workspaceState: {
      get<T>(key: string): T | undefined;
      update(key: string, value: unknown): Promise<void> | Thenable<void>;
    };
  },
  fileExists: (filePath: string) => boolean = existsSync,
): SessionTracker {
  const read = () => context.workspaceState.get<SessionMap>(SESSIONS_KEY) ?? {};
  const write = (map: SessionMap) => context.workspaceState.update(SESSIONS_KEY, map);

  return {
    read,
    async update(sessionId, sessionFile) {
      const map = read();
      if (map[sessionId] === sessionFile) return;
      map[sessionId] = sessionFile;
      await write(map);
    },
    async remove(sessionId) {
      const map = read();
      if (!(sessionId in map)) return;
      delete map[sessionId];
      await write(map);
    },
    async pruneMissingSessions() {
      const map = read();
      const valid: SessionMap = {};
      for (const [sessionId, sessionFile] of Object.entries(map)) {
        if (fileExists(sessionFile)) valid[sessionId] = sessionFile;
      }
      if (Object.keys(valid).length !== Object.keys(map).length) {
        await write(valid);
      }
      return valid;
    },
  };
}
