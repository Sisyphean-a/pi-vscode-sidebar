import { describe, expect, it } from "vitest";
import {
  compareRecentSessions,
  parseRecentSessionSummary,
} from "../../../src/session/recent-sessions-summary.ts";

function buildSessionFile(lines: unknown[]): string {
  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

describe("recent session summary", () => {
  it("prefers explicit session name and latest activity from message timestamps", () => {
    const summary = parseRecentSessionSummary({
      sessionPath: "C:\\sessions\\feature.jsonl",
      fallbackUpdatedAt: "2026-05-26T00:00:00.000Z",
      rawContent: buildSessionFile([
        {
          type: "session",
          id: "session-feature",
          timestamp: "2026-05-26T00:10:00.000Z",
        },
        {
          type: "session_info",
          name: "  优化任务流转  ",
        },
        {
          type: "message",
          timestamp: "2026-05-26T01:00:00.000Z",
          message: {
            role: "user",
            content: [{ type: "text", text: "首条用户消息不该覆盖标题" }],
          },
        },
        {
          type: "message",
          timestamp: "2026-05-26T02:30:00.000Z",
          message: {
            role: "assistant",
            content: "好的，我先整理结构。",
          },
        },
      ]),
    });

    expect(summary).toEqual({
      sessionId: "session-feature",
      sessionPath: "C:\\sessions\\feature.jsonl",
      title: "优化任务流转",
      updatedAt: "2026-05-26T02:30:00.000Z",
    });
  });

  it("falls back to file name and file mtime when content is empty or broken", () => {
    const summary = parseRecentSessionSummary({
      sessionPath: "C:\\sessions\\broken.jsonl",
      fallbackUpdatedAt: "2026-05-26T03:00:00.000Z",
      rawContent: `{"type":"session","id":"broken"}\nnot-json\n`,
    });

    expect(summary).toEqual({
      sessionId: "broken",
      sessionPath: "C:\\sessions\\broken.jsonl",
      title: "无标题对话",
      updatedAt: "2026-05-26T03:00:00.000Z",
    });
  });

  it("sorts newer sessions first and breaks ties by title", () => {
    const sorted = [
      {
        sessionId: "2",
        sessionPath: "b.jsonl",
        title: "乙任务",
        updatedAt: "2026-05-26T01:00:00.000Z",
      },
      {
        sessionId: "1",
        sessionPath: "a.jsonl",
        title: "甲任务",
        updatedAt: "2026-05-26T01:00:00.000Z",
      },
      {
        sessionId: "3",
        sessionPath: "c.jsonl",
        title: "丙任务",
        updatedAt: "2026-05-26T00:00:00.000Z",
      },
    ].sort(compareRecentSessions);

    expect(sorted.map((item) => item.sessionId)).toEqual(["1", "2", "3"]);
  });
});
