// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  syncActivityEntryDetail,
  type ActivityEntryDetailRefs,
} from "../../../src/view/webview/activity-transcript-entry-detail.ts";

describe("activity transcript entry detail", () => {
  beforeEach(() => {
    document.body.innerHTML = `<ol id="activity-list"></ol>`;
  });

  it("creates detail markup around the shared label and restores inline markup when detail clears", () => {
    const entry = createEntryRefs();

    syncActivityEntryDetail(entry, '{"path":"src/session/tracker.ts"}', "查看参数");

    expect(document.querySelector(".chat-activity-item-detail-summary")?.textContent).toBe(
      "修改内容（edit）",
    );
    expect(
      document.querySelector(".chat-activity-item-detail-summary")?.getAttribute("title"),
    ).toBe("查看参数");
    expect(document.querySelector(".chat-activity-item-detail-pre")?.textContent).toBe(
      '{"path":"src/session/tracker.ts"}',
    );

    syncActivityEntryDetail(entry, undefined, undefined);

    expect(document.querySelector(".chat-activity-item-detail")).toBeNull();
    expect(document.querySelector(".chat-activity-item-body")?.textContent).toBe(
      "修改内容（edit）",
    );
    expect(entry.detail).toBeUndefined();
    expect(entry.detailSummary).toBeUndefined();
    expect(entry.detailPre).toBeUndefined();
  });

  it("reuses existing detail nodes and falls back to the default summary title", () => {
    const entry = createEntryRefs();

    syncActivityEntryDetail(entry, "first", "查看参数");
    const firstDetail = entry.detail;
    const firstPre = entry.detailPre;

    syncActivityEntryDetail(entry, "second", undefined);

    expect(entry.detail).toBe(firstDetail);
    expect(entry.detailPre).toBe(firstPre);
    expect(entry.detailSummary?.getAttribute("title")).toBe("展开详情");
    expect(entry.detailPre?.textContent).toBe("second");
  });
});

function createEntryRefs(): ActivityEntryDetailRefs {
  const list = document.getElementById("activity-list");
  if (!list) throw new Error("Missing activity list.");

  const item = document.createElement("li");
  item.className = "chat-activity-item";

  const body = document.createElement("div");
  body.className = "chat-activity-item-body";

  const label = document.createElement("span");
  label.className = "chat-activity-item-label";
  label.textContent = "修改内容（edit）";

  body.append(label);
  item.append(body);
  list.append(item);

  return {
    body,
    item,
    label,
  };
}
