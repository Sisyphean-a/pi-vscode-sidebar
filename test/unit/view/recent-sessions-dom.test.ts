// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRecentSessionsDom } from "../../../src/view/webview/recent-sessions-dom.ts";

describe("recent sessions dom", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="recent-sessions-section"></section>
      <div id="recent-sessions-preview"></div>
      <button id="recent-sessions-more-button" type="button"></button>
      <div id="recent-sessions-overlay" class="hidden"></div>
      <h2 id="recent-sessions-dialog-title"></h2>
      <div id="recent-sessions-dialog-list"></div>
    `;
  });

  it("renders preview and dialog session buttons with active state", () => {
    const onSelectSession = vi.fn();

    renderRecentSessionsDom(
      {
        activeSessionPath: "C:\\sessions\\session-2.jsonl",
        dialogList: getElement("recent-sessions-dialog-list"),
        dialogTitle: getElement("recent-sessions-dialog-title"),
        moreButton: getElement<HTMLButtonElement>("recent-sessions-more-button"),
        onSelectSession,
        overlay: getElement("recent-sessions-overlay"),
        preview: getElement("recent-sessions-preview"),
        section: getElement("recent-sessions-section"),
      },
      {
        allSessions: createSessions(),
        dialogOpen: true,
        dialogTitleText: "全部任务（4 个）",
        moreButtonText: "查看全部（4 个）",
        previewSessions: createSessions().slice(0, 3),
        sectionHidden: false,
        showMoreButton: true,
      },
    );

    expect(getElement("recent-sessions-overlay").classList.contains("hidden")).toBe(false);
    expect(getElement("recent-sessions-dialog-title").textContent).toBe("全部任务（4 个）");
    expect(document.querySelectorAll("#recent-sessions-preview .recent-session-item")).toHaveLength(
      3,
    );
    expect(
      document.querySelectorAll("#recent-sessions-dialog-list .recent-session-item"),
    ).toHaveLength(4);
    expect(
      document.querySelectorAll("#recent-sessions-preview .recent-session-item.is-active"),
    ).toHaveLength(1);

    (
      document.querySelectorAll("#recent-sessions-dialog-list .recent-session-item")[3] as
        | HTMLButtonElement
        | undefined
    )?.click();
    expect(onSelectSession).toHaveBeenCalledWith("C:\\sessions\\session-4.jsonl");
  });

  it("clears lists and hides the more button when there are no sessions", () => {
    renderRecentSessionsDom(
      {
        activeSessionPath: undefined,
        dialogList: getElement("recent-sessions-dialog-list"),
        dialogTitle: getElement("recent-sessions-dialog-title"),
        moreButton: getElement<HTMLButtonElement>("recent-sessions-more-button"),
        onSelectSession() {},
        overlay: getElement("recent-sessions-overlay"),
        preview: getElement("recent-sessions-preview"),
        section: getElement("recent-sessions-section"),
      },
      {
        allSessions: [],
        dialogOpen: false,
        dialogTitleText: "",
        moreButtonText: "",
        previewSessions: [],
        sectionHidden: true,
        showMoreButton: false,
      },
    );

    expect(getElement("recent-sessions-section").classList.contains("hidden")).toBe(true);
    expect(
      getElement<HTMLButtonElement>("recent-sessions-more-button").classList.contains("hidden"),
    ).toBe(true);
    expect(getElement("recent-sessions-preview").childElementCount).toBe(0);
    expect(getElement("recent-sessions-dialog-list").childElementCount).toBe(0);
  });
});

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
