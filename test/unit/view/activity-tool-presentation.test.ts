import { describe, expect, it } from "vitest";
import {
  resolveToolFamily,
  summarizeToolDetailSummary,
  summarizeToolLabel,
  summarizeToolResultDetailSummary,
} from "../../../src/view/webview/features/activity/tool-presentation.ts";

describe("activity tool presentation", () => {
  it("summarizes tool labels from known args and output conventions", () => {
    expect(summarizeToolLabel("read", '{"path":"src/view/webview/app.ts"}')).toBe(
      "读取：src/view/webview/app.ts",
    );
    expect(
      summarizeToolLabel("exec_command", undefined, "\n\nfirst useful line\nsecond line"),
    ).toBe("bash：first useful line");
    expect(summarizeToolLabel("search", '{"query":"activity-controller"}')).toBe(
      "搜索：activity-controller",
    );
  });

  it("maps detail summaries and families without changing current ui wording", () => {
    expect(summarizeToolDetailSummary("exec_command", '{"command":"npm test"}')).toBe(
      "查看 npm test 参数",
    );
    expect(summarizeToolResultDetailSummary("exec_command", "output")).toBe("查看命令输出");
    expect(summarizeToolResultDetailSummary("read", "   ")).toBe("查看结果");
    expect(resolveToolFamily("codegraph_search")).toBe("codegraph");
    expect(resolveToolFamily("open")).toBe("web");
    expect(resolveToolFamily("exec_command")).toBe("command");
    expect(resolveToolFamily("read")).toBe("tool");
  });
});
