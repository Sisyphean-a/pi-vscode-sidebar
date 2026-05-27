// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createActivityGroupRefs,
  ensureActivityEntryRefs,
  syncActivityEntryRefs,
  syncActivityGroupRefs,
} from "../../../src/view/webview/activity-transcript-dom.ts";

describe("activity transcript dom", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="activity-root"></div>`;
  });

  it("uses the row as detail summary and restores inline label when detail is cleared", () => {
    const container = document.getElementById("activity-root");
    if (!container) throw new Error("Missing activity container.");

    const group = createActivityGroupRefs(container, {
      collapsed: true,
      entries: new Map(),
      familySet: new Set(),
      groupKey: "group-1",
      labels: [],
      summaryText: "已执行 0 个操作",
    });
    const entry = ensureActivityEntryRefs(group, {
      entryKey: "entry-1",
      label: "修改内容（edit）",
      status: "running",
    });

    syncActivityEntryRefs(entry, {
      entryKey: "entry-1",
      label: "修改内容（edit）",
      status: "done",
      detail: '{"path":"src/session/tracker.ts"}',
      detailSummary: "查看参数",
    });

    expect(container.querySelector(".chat-activity-item-detail-summary")?.textContent).toBe(
      "修改内容（edit）",
    );
    expect(container.textContent).not.toContain("查看参数");

    syncActivityEntryRefs(entry, {
      entryKey: "entry-1",
      label: "修改内容（edit）",
      status: "done",
    });

    expect(container.querySelector(".chat-activity-item-detail")).toBeNull();
    expect(container.querySelector(".chat-activity-item-body")?.textContent).toBe(
      "修改内容（edit）",
    );
  });

  it("syncs group collapsed state and summary text to details element", () => {
    const container = document.getElementById("activity-root");
    if (!container) throw new Error("Missing activity container.");

    const group = createActivityGroupRefs(container, {
      collapsed: true,
      entries: new Map(),
      familySet: new Set(),
      groupKey: "group-2",
      labels: [],
      summaryText: "已执行 0 个操作",
    });

    syncActivityGroupRefs(group, {
      collapsed: false,
      entries: new Map(),
      familySet: new Set(),
      groupKey: "group-2",
      labels: [],
      summaryText: "正在执行 1 个步骤",
    });

    expect(group.root.open).toBe(true);
    expect(group.root.dataset.collapsed).toBe("false");
    expect(group.summary.textContent).toBe("正在执行 1 个步骤");
  });
});
