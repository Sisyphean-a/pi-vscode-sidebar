import { describe, expect, it } from "vitest";

import { createPanelLogPresentation } from "../../../src/view/webview/panel-log-presentation.ts";

describe("panel log presentation", () => {
  it("formats same-day timestamps as local time while keeping metadata readable", () => {
    const entry = createPanelLogPresentation(
      '{"timestamp":"2026-05-28T07:53:49.009Z","level":"info","scope":"rpc","message":"rpc inbound response","correlationId":"req_1234567890"}',
      {
        now: new Date("2026-05-28T08:00:00.000Z"),
        timeZone: "UTC",
      },
    );

    expect(entry.summaryTime).toBe("07:53:49.009");
    expect(entry.levelLabel).toBe("INFO");
    expect(entry.message).toBe("rpc inbound response");
    expect(entry.summaryMeta).toEqual(["rpc", "#req_1234"]);
    expect("detailItems" in entry).toBe(false);
  });

  it("adds a compact date prefix when the log is not from today", () => {
    const entry = createPanelLogPresentation(
      '{"timestamp":"2026-05-27T23:53:49.009Z","level":"warn","scope":"rpc","message":"rpc stderr"}',
      {
        now: new Date("2026-05-28T08:00:00.000Z"),
        timeZone: "UTC",
      },
    );

    expect(entry.summaryTime).toBe("05-27 23:53");
    expect(entry.levelLabel).toBe("WARN");
    expect("detailItems" in entry).toBe(false);
  });

  it("preserves raw text lines when the payload is not json", () => {
    const entry = createPanelLogPresentation("plain text log line");

    expect(entry.summaryTime).toBe("");
    expect(entry.levelLabel).toBe("");
    expect(entry.message).toBe("plain text log line");
    expect(entry.summaryMeta).toEqual([]);
    expect("detailItems" in entry).toBe(false);
    expect(entry.content).toBe("plain text log line");
  });
});
