import { describe, expect, it } from "vitest";

import type { ActivityGroupState } from "../../../src/view/webview/activity-transcript-state.ts";
import {
  rememberActivityGroupLabel,
  refreshActivityGroupSummary,
  summarizeCompletedActivityGroup,
} from "../../../src/view/webview/activity-transcript-summary.ts";

describe("activity transcript summary", () => {
  it("keeps groups expanded while running entries remain", () => {
    const group: ActivityGroupState = {
      collapsed: true,
      entries: new Map([
        ["read-1", { entryKey: "read-1", label: "读取：a.ts", status: "running", family: "tool" }],
        [
          "bash-1",
          { entryKey: "bash-1", label: "bash：git status", status: "running", family: "command" },
        ],
      ]),
      familySet: new Set(["tool", "command"]),
      groupKey: "group-1",
      labels: ["读取", "bash"],
      summaryText: "",
    };

    refreshActivityGroupSummary(group);

    expect(group.summaryText).toBe("正在执行 2 个步骤");
    expect(group.collapsed).toBe(false);
  });

  it("summarizes completed groups by label first, then by special family fallbacks", () => {
    const labeledGroup: ActivityGroupState = {
      collapsed: false,
      entries: new Map([
        ["read-1", { entryKey: "read-1", label: "读取：a.ts", status: "done", family: "tool" }],
        [
          "bash-1",
          { entryKey: "bash-1", label: "bash：git status", status: "done", family: "command" },
        ],
      ]),
      familySet: new Set(["tool", "command"]),
      groupKey: "group-1",
      labels: ["读取", "bash"],
      summaryText: "",
    };
    const codegraphGroup: ActivityGroupState = {
      collapsed: false,
      entries: new Map([
        [
          "cg-1",
          { entryKey: "cg-1", label: "codegraph：files", status: "done", family: "codegraph" },
        ],
      ]),
      familySet: new Set(["codegraph"]),
      groupKey: "group-2",
      labels: [],
      summaryText: "",
    };

    expect(summarizeCompletedActivityGroup(labeledGroup)).toBe("执行了：读取、bash");
    expect(summarizeCompletedActivityGroup(codegraphGroup)).toBe("已使用 Codegraph");
  });

  it("ignores thinking labels and deduplicates by display prefix", () => {
    expect(rememberActivityGroupLabel([], "思考：先梳理结构", "thinking")).toEqual([]);
    expect(rememberActivityGroupLabel([], "读取：a.ts", "tool")).toEqual(["读取"]);
    expect(rememberActivityGroupLabel(["读取"], "读取：b.ts", "tool")).toEqual(["读取"]);
  });
});
