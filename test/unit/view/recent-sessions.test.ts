// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { RecentSessionSummary } from "../../../src/shared/recent-sessions.ts";
import { createRecentSessionsPanel } from "../../../src/view/webview/recent-sessions.ts";

describe("recent sessions panel", () => {
  it("supports open/close/select flow while keeping active session behavior", () => {
    const harness = createHarness();
    const panel = createRecentSessionsPanel(harness.options);

    panel.update(createSessions(), "C:\\sessions\\session-2.jsonl");
    expect(harness.preview.querySelectorAll(".recent-session-item")).toHaveLength(3);
    expect(harness.dialogList.querySelectorAll(".recent-session-item")).toHaveLength(4);

    harness.moreButton.click();
    expect(harness.overlay.classList.contains("hidden")).toBe(false);

    const dialogButtons =
      harness.dialogList.querySelectorAll<HTMLButtonElement>(".recent-session-item");
    dialogButtons[1]?.click();
    expect(harness.onSelect).not.toHaveBeenCalled();
    expect(harness.overlay.classList.contains("hidden")).toBe(true);

    harness.moreButton.click();
    const reopenedDialogButtons =
      harness.dialogList.querySelectorAll<HTMLButtonElement>(".recent-session-item");
    reopenedDialogButtons[2]?.click();
    expect(harness.onSelect).toHaveBeenCalledWith("C:\\sessions\\session-3.jsonl");
    expect(harness.overlay.classList.contains("hidden")).toBe(true);

    panel.setVisible(false);
    expect(harness.section.classList.contains("hidden")).toBe(true);
    expect(harness.overlay.classList.contains("hidden")).toBe(true);
  });
});

function createHarness() {
  const section = document.createElement("section");
  const preview = document.createElement("div");
  const moreButton = document.createElement("button");
  const overlay = document.createElement("div");
  const dialogTitle = document.createElement("h2");
  const dialogList = document.createElement("div");
  const closeButton = document.createElement("button");
  const onSelect = vi.fn();

  return {
    dialogTitle,
    dialogList,
    moreButton,
    onSelect,
    options: {
      closeButton,
      dialogList,
      dialogTitle,
      moreButton,
      onSelect,
      overlay,
      preview,
      section,
    },
    overlay,
    preview,
    section,
  };
}

function createSessions(): RecentSessionSummary[] {
  return [
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
  ];
}
