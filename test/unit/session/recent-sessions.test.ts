import { describe, expect, it } from "vitest";
import { createRecentSessionsProvider } from "../../../src/session/recent-sessions.ts";

function buildSessionFile(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

describe("createRecentSessionsProvider", () => {
  it("reads workspace sessions from pi agent storage, prefers session names, and sorts by latest activity", async () => {
    const sessionDir = "C:\\Users\\xiakn\\.pi\\agent\\sessions\\--E--github-pi-vscode-sidebar--";
    const files = new Map<string, string>([
      [
        `${sessionDir}\\older.jsonl`,
        buildSessionFile([
          {
            type: "session",
            id: "session-older",
            timestamp: "2026-05-26T00:10:00.000Z",
            cwd: "E:\\github\\pi-vscode-sidebar",
          },
          {
            type: "message",
            id: "msg-1",
            parentId: null,
            timestamp: "2026-05-26T00:11:00.000Z",
            message: {
              role: "user",
              content: "第一个历史任务",
            },
          },
        ]),
      ],
      [
        `${sessionDir}\\newer.jsonl`,
        buildSessionFile([
          {
            type: "session",
            id: "session-newer",
            timestamp: "2026-05-26T01:10:00.000Z",
            cwd: "E:\\github\\pi",
          },
          {
            type: "session_info",
            id: "info-1",
            parentId: null,
            timestamp: "2026-05-26T01:11:00.000Z",
            name: "  优化最近任务面板  ",
          },
          {
            type: "message",
            id: "msg-2",
            parentId: "info-1",
            timestamp: "2026-05-26T01:12:00.000Z",
            message: {
              role: "user",
              content: [{ type: "text", text: "这条首条用户消息不该覆盖自定义标题" }],
            },
          },
          {
            type: "message",
            id: "msg-3",
            parentId: "msg-2",
            timestamp: "2026-05-26T02:30:00.000Z",
            message: {
              role: "assistant",
              content: "好的，我先整理实现方案。",
            },
          },
        ]),
      ],
      [`${sessionDir}\\invalid.jsonl`, `{"type":"session","id":"broken"}\nnot-json\n`],
    ]);

    const provider = createRecentSessionsProvider(
      {
        workspaceDir: "E:\\github\\pi-vscode-sidebar",
      },
      {
        homedir() {
          return "C:\\Users\\xiakn";
        },
        async readdir(path) {
          expect(path).toBe(sessionDir);
          return ["older.jsonl", "notes.txt", "newer.jsonl", "invalid.jsonl"];
        },
        async readFile(path) {
          const file = files.get(path);
          if (!file) throw new Error(`missing file: ${path}`);
          return file;
        },
        async stat(path) {
          if (path === `${sessionDir}\\older.jsonl`) {
            return { mtime: new Date("2026-05-26T00:12:00.000Z") };
          }
          if (path === `${sessionDir}\\newer.jsonl`) {
            return { mtime: new Date("2026-05-26T02:00:00.000Z") };
          }
          return { mtime: new Date("2026-05-26T00:00:00.000Z") };
        },
      },
    );

    await expect(provider.list()).resolves.toEqual([
      {
        sessionId: "session-newer",
        sessionPath: `${sessionDir}\\newer.jsonl`,
        title: "优化最近任务面板",
        updatedAt: "2026-05-26T02:30:00.000Z",
      },
      {
        sessionId: "session-older",
        sessionPath: `${sessionDir}\\older.jsonl`,
        title: "第一个历史任务",
        updatedAt: "2026-05-26T00:11:00.000Z",
      },
      {
        sessionId: "broken",
        sessionPath: `${sessionDir}\\invalid.jsonl`,
        title: "无标题对话",
        updatedAt: "2026-05-26T00:00:00.000Z",
      },
    ]);
  });
});
