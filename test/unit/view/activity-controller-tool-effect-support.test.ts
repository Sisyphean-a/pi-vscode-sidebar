import { describe, expect, it } from "vitest";

import { createEffectPlan } from "../../../src/view/webview/features/activity/controller-effect-plan.ts";
import {
  createActivityControllerState,
  rememberToolActivity,
} from "../../../src/view/webview/features/activity/controller-state.ts";
import {
  buildToolCallTranscriptUpdate,
  buildToolExecutionTranscriptUpdate,
  buildToolResultTranscriptUpdate,
  resolvePlannedToolGroupKey,
  resolveToolResultEntryKeyFromContext,
  resolveToolRunningEntryKey,
} from "../../../src/view/webview/features/activity/controller-tool-effect-support.ts";

describe("activity controller tool effect support", () => {
  it("resolves planned tool group key from remembered tool activity or assistant response", () => {
    const plan = createEffectPlan();
    const state = createActivityControllerState();
    rememberToolActivity(state, {
      groupKey: "assistant-activity:resp-2",
      toolCallId: "call-2",
      toolArgs: '{"path":"src/app.ts"}',
    });

    expect(
      resolvePlannedToolGroupKey(plan, state, {
        responseId: "resp-3",
        toolCallId: "call-2",
        toolName: "read",
      }),
    ).toBe("assistant-activity:resp-2");

    expect(
      resolvePlannedToolGroupKey(plan, state, {
        responseId: "resp-4",
        toolName: "read",
      }),
    ).toBe("assistant-activity:resp-4");
  });

  it("builds running and finished transcript updates for tool call / result messages", () => {
    const context = {
      groupKey: "assistant-activity:resp-5",
      responseId: "resp-5",
      toolCallId: "call-5",
      toolName: "read",
      toolArgs: '{"path":"README.md"}',
      toolText: "line 1\nline 2",
    };

    expect(resolveToolRunningEntryKey(context)).toBe("call-5");
    expect(resolveToolResultEntryKeyFromContext(context)).toBe("call-5");
    expect(buildToolCallTranscriptUpdate(context)).toEqual({
      groupKey: "assistant-activity:resp-5",
      entryKey: "call-5",
      status: "running",
      label: "读取：README.md",
      detail: '{"path":"README.md"}',
      detailSummary: "查看参数",
      family: "tool",
    });
    expect(buildToolResultTranscriptUpdate(context)).toEqual({
      groupKey: "assistant-activity:resp-5",
      entryKey: "call-5",
      status: "done",
      label: "读取：README.md",
      detail: "line 1\nline 2",
      detailSummary: "查看详情",
      family: "tool",
    });
  });

  it("builds execution transcript updates with command output aware summaries", () => {
    expect(
      buildToolExecutionTranscriptUpdate(
        {
          groupKey: "assistant-activity:resp-6",
          responseId: "resp-6",
          toolCallId: "call-6",
          toolName: "exec_command",
          toolArgs: '{\n  "command": "npm test"\n}',
          toolText: "PASS",
        },
        "done",
      ),
    ).toEqual({
      groupKey: "assistant-activity:resp-6",
      entryKey: "call-6",
      status: "done",
      label: "bash：npm test",
      detail: "PASS",
      detailSummary: "查看命令输出",
      family: "command",
    });
  });
});
