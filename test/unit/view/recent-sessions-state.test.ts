import { describe, expect, it } from "vitest";
import {
  closeRecentSessionsDialog,
  createRecentSessionsPanelState,
  formatRecentSessionTime,
  getRecentSessionsRenderState,
  openRecentSessionsDialog,
  selectRecentSession,
  setRecentSessionsVisibility,
  updateRecentSessionsState,
} from "../../../src/view/webview/recent-sessions-state.ts";

describe("recent sessions state", () => {
  it("builds preview/full lists and only opens dialog when more than preview limit", () => {
    const state = createRecentSessionsPanelState();
    updateRecentSessionsState(
      state,
      [
        {
          sessionId: "session-1",
          sessionPath: "C:\\sessions\\session-1.jsonl",
          title: "A",
          updatedAt: "2026-05-26T02:59:00.000Z",
        },
        {
          sessionId: "session-2",
          sessionPath: "C:\\sessions\\session-2.jsonl",
          title: "B",
          updatedAt: "2026-05-26T02:52:00.000Z",
        },
        {
          sessionId: "session-3",
          sessionPath: "C:\\sessions\\session-3.jsonl",
          title: "C",
          updatedAt: "2026-05-26T02:03:00.000Z",
        },
        {
          sessionId: "session-4",
          sessionPath: "C:\\sessions\\session-4.jsonl",
          title: "D",
          updatedAt: "2026-05-25T18:03:00.000Z",
        },
      ],
      "C:\\sessions\\session-2.jsonl",
    );

    expect(openRecentSessionsDialog(state)).toBe(true);

    const render = getRecentSessionsRenderState(state);
    expect(render.sectionHidden).toBe(false);
    expect(render.dialogOpen).toBe(true);
    expect(render.previewSessions.map((session) => session.title)).toEqual(["A", "B", "C"]);
    expect(render.allSessions.map((session) => session.title)).toEqual(["A", "B", "C", "D"]);
    expect(render.dialogTitleText).toBe("全部任务（4 个）");
    expect(render.moreButtonText).toBe("查看全部（4 个）");
    expect(render.showMoreButton).toBe(true);
  });

  it("closes dialog when hidden and ignores selecting the active session", () => {
    const state = createRecentSessionsPanelState();
    updateRecentSessionsState(
      state,
      [
        {
          sessionId: "session-2",
          sessionPath: "C:\\sessions\\session-2.jsonl",
          title: "B",
          updatedAt: "2026-05-26T02:52:00.000Z",
        },
      ],
      "C:\\sessions\\session-2.jsonl",
    );

    expect(openRecentSessionsDialog(state)).toBe(false);
    expect(selectRecentSession(state, "C:\\sessions\\session-2.jsonl")).toEqual({
      shouldSelect: false,
    });

    setRecentSessionsVisibility(state, false);
    expect(getRecentSessionsRenderState(state).sectionHidden).toBe(true);
    expect(getRecentSessionsRenderState(state).dialogOpen).toBe(false);

    closeRecentSessionsDialog(state);
    expect(getRecentSessionsRenderState(state).dialogOpen).toBe(false);
  });

  it("formats relative recent session time without changing UI copy", () => {
    const now = Date.parse("2026-05-26T03:00:00.000Z");

    expect(formatRecentSessionTime("2026-05-26T02:59:40.000Z", now)).toBe("刚刚");
    expect(formatRecentSessionTime("2026-05-26T02:50:00.000Z", now)).toBe("10 分");
    expect(formatRecentSessionTime("2026-05-25T23:00:00.000Z", now)).toBe("4 小时");
    expect(formatRecentSessionTime("2026-05-23T03:00:00.000Z", now)).toBe("3 天");
  });
});
