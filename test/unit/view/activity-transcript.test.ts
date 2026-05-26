// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createActivityTranscript } from "../../../src/view/webview/activity-transcript.ts";

describe("createActivityTranscript", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="activity-root"></div>`;
  });

  it("uses the activity row itself as the disclosure summary for details", () => {
    const container = document.getElementById("activity-root");
    if (!container) {
      throw new Error("Missing activity container.");
    }

    const transcript = createActivityTranscript({ container });
    transcript.record({
      groupKey: "tool-group-1",
      entryKey: "tool-entry-1",
      status: "done",
      label: "修改内容（edit）",
      detail: '{"path":"src/session/tracker.ts"}',
      detailSummary: "查看参数",
      family: "tool",
    });

    const detail = container.querySelector(
      ".chat-activity-item-detail",
    ) as HTMLDetailsElement | null;
    const summary = container.querySelector(
      ".chat-activity-item-detail-summary",
    ) as HTMLElement | null;

    expect(detail).not.toBeNull();
    expect(summary?.textContent).toBe("修改内容（edit）");
    expect(container.textContent).not.toContain("查看参数");
  });
});
