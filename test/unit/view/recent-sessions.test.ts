// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { RecentSessionSummary } from "../../../src/shared/recent-sessions.ts";
import { createRecentSessionsPanel } from "../../../src/view/webview/features/recent-sessions/panel.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("recent sessions panel", () => {
  it("supports open/close/select flow while keeping active session behavior", () => {
    const harness = createHarness();
    const panel = createRecentSessionsPanel(harness.options);

    panel.update(createSessions(), "C:\\sessions\\session-2.jsonl");
    expect(harness.sectionRoot.querySelectorAll(".recent-session-item")).toHaveLength(3);

    harness.expectElement<HTMLButtonElement>(".recent-sessions-more", harness.sectionRoot).click();
    expect(harness.overlayRoot.querySelector(".recent-sessions-overlay")).not.toBeNull();

    const dialogButtons = harness.overlayRoot.querySelectorAll<HTMLButtonElement>(
      ".recent-session-item",
    );
    expect(dialogButtons).toHaveLength(4);
    dialogButtons[1]?.click();
    expect(harness.onSelect).not.toHaveBeenCalled();
    expect(harness.overlayRoot.querySelector(".recent-sessions-overlay")).toBeNull();

    harness.expectElement<HTMLButtonElement>(".recent-sessions-more", harness.sectionRoot).click();
    const reopenedDialogButtons = harness.overlayRoot.querySelectorAll<HTMLButtonElement>(
      ".recent-session-item",
    );
    reopenedDialogButtons[2]?.click();
    expect(harness.onSelect).toHaveBeenCalledWith("C:\\sessions\\session-3.jsonl");
    expect(harness.overlayRoot.querySelector(".recent-sessions-overlay")).toBeNull();

    panel.setVisible(false);
    expect(harness.sectionRoot.innerHTML).toBe("");
    expect(harness.overlayRoot.innerHTML).toBe("");
  });
});

function createHarness() {
  const sectionRoot = document.createElement("div");
  const overlayRoot = document.createElement("div");
  const onSelect = vi.fn();

  return {
    onSelect,
    options: {
      onSelect,
      overlayView: createPreactRenderPort(overlayRoot),
      sectionView: createPreactRenderPort(sectionRoot),
    },
    overlayRoot,
    sectionRoot,
    expectElement<TElement extends Element>(selector: string, root: ParentNode): TElement {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing element: ${selector}`);
      return element as TElement;
    },
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
