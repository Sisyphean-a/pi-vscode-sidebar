import { describe, expect, it } from "vitest";
import {
  createActivityTranscriptState,
  finalizeActivityGroup,
  recordActivityEntry,
} from "../../../src/view/webview/activity-transcript-state.ts";

describe("activity transcript state", () => {
  it("expands while entries are running and collapses to completed thinking summary", () => {
    const state = createActivityTranscriptState();

    const running = recordActivityEntry(state, {
      groupKey: "thinking-1",
      entryKey: "thinking-entry-1",
      label: "思考：先梳理调用链。",
      status: "running",
      family: "thinking",
    });

    expect(running.group.summaryText).toBe("正在思考");
    expect(running.group.collapsed).toBe(false);

    const done = recordActivityEntry(state, {
      groupKey: "thinking-1",
      entryKey: "thinking-entry-1",
      label: "思考：先梳理调用链。",
      status: "done",
      family: "thinking",
    });
    expect(done.group.summaryText).toBe("已完成思考");
    expect(done.group.collapsed).toBe(true);

    const finalized = finalizeActivityGroup(state, "thinking-1");
    expect(finalized?.summaryText).toBe("已完成思考");
    expect(finalized?.collapsed).toBe(true);
  });

  it("deduplicates non-thinking labels and summarizes completed groups by prefix", () => {
    const state = createActivityTranscriptState();

    recordActivityEntry(state, {
      groupKey: "tools-1",
      entryKey: "read-1",
      label: "读取：src/view/webview/app.ts",
      status: "running",
      family: "tool",
    });
    const updated = recordActivityEntry(state, {
      groupKey: "tools-1",
      entryKey: "bash-1",
      label: "bash：git status",
      status: "done",
      family: "command",
    });
    recordActivityEntry(state, {
      groupKey: "tools-1",
      entryKey: "read-2",
      label: "读取：src/view/webview/model-controls.ts",
      status: "done",
      family: "tool",
    });

    expect(updated.group.summaryText).toBe("正在执行 1 个步骤");

    const finalized = finalizeActivityGroup(state, "tools-1");
    expect(finalized?.summaryText).toBe("执行了：读取、bash");
    expect(finalized?.collapsed).toBe(true);
  });
});
