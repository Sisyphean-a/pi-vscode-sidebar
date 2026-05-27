// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecentSessionsPanel } from "../../../src/view/webview/recent-sessions.ts";

describe("recent sessions panel", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="recent-sessions-section"></section>
      <div id="recent-sessions-preview"></div>
      <button id="recent-sessions-more-button" type="button"></button>
      <div id="recent-sessions-overlay" class="hidden"></div>
      <h2 id="recent-sessions-dialog-title"></h2>
      <div id="recent-sessions-dialog-list"></div>
      <button id="recent-sessions-dialog-close" type="button"></button>
    `;
  });

  it("renders preview and dialog lists, and only selects a different session", () => {
    const onSelect = vi.fn();
    const panel = createRecentSessionsPanel(createOptions(onSelect));

    panel.update(createSessions(), "C:\\sessions\\session-2.jsonl");

    const previewItems = document.querySelectorAll("#recent-sessions-preview .recent-session-item");
    const moreButton = getElement<HTMLButtonElement>("recent-sessions-more-button");
    expect(previewItems).toHaveLength(3);
    expect(previewItems[1]?.classList.contains("is-active")).toBe(true);
    expect(moreButton.textContent).toBe("查看全部（4 个）");

    (previewItems[1] as HTMLButtonElement | undefined)?.click();
    expect(onSelect).not.toHaveBeenCalled();

    moreButton.click();
    const dialogItems = document.querySelectorAll(
      "#recent-sessions-dialog-list .recent-session-item",
    );
    expect(getElement("recent-sessions-overlay").classList.contains("hidden")).toBe(false);
    expect(getElement("recent-sessions-dialog-title").textContent).toBe("全部任务（4 个）");
    expect(dialogItems).toHaveLength(4);

    (dialogItems[3] as HTMLButtonElement | undefined)?.click();
    expect(onSelect).toHaveBeenCalledWith("C:\\sessions\\session-4.jsonl");
    expect(getElement("recent-sessions-overlay").classList.contains("hidden")).toBe(true);
  });

  it("closes the dialog when the overlay background is clicked", () => {
    const panel = createRecentSessionsPanel(createOptions(() => {}));

    panel.update(createSessions(), "C:\\sessions\\session-2.jsonl");
    getElement<HTMLButtonElement>("recent-sessions-more-button").click();
    expect(getElement("recent-sessions-overlay").classList.contains("hidden")).toBe(false);

    getElement("recent-sessions-overlay").click();
    expect(getElement("recent-sessions-overlay").classList.contains("hidden")).toBe(true);
  });
});

function createOptions(onSelect: (sessionPath: string) => void) {
  return {
    section: getElement("recent-sessions-section"),
    preview: getElement("recent-sessions-preview"),
    moreButton: getElement<HTMLButtonElement>("recent-sessions-more-button"),
    overlay: getElement("recent-sessions-overlay"),
    dialogTitle: getElement("recent-sessions-dialog-title"),
    dialogList: getElement("recent-sessions-dialog-list"),
    closeButton: getElement<HTMLButtonElement>("recent-sessions-dialog-close"),
    onSelect,
  };
}

function createSessions() {
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

function getElement<TElement extends HTMLElement = HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
