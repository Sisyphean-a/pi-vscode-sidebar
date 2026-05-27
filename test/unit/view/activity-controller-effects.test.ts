import { describe, expect, it } from "vitest";
import {
  createActivityControllerState,
  rememberToolActivity,
} from "../../../src/view/webview/activity-controller-state.ts";
import {
  planMessageEndEffects,
  planMessageUpdateEffects,
  planToolExecutionEffects,
} from "../../../src/view/webview/activity-controller-effects.ts";
import { planHistoryMessageEffects } from "../../../src/view/webview/activity-controller-history-effects.ts";

describe("activity controller effects", () => {
  it("plans assistant message end with stream promotion and activity finalization", () => {
    const state = createActivityControllerState();

    const plan = planMessageEndEffects(state, {
      responseId: "resp-1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "最终答复" }],
      },
    });

    expect(plan.effects).toEqual([
      {
        type: "renameGroup",
        fromKey: "assistant-thinking:live",
        toKey: "assistant-thinking:resp-1",
      },
      {
        type: "finalizeGroup",
        groupKey: "assistant-thinking:resp-1",
      },
      {
        type: "feedMessage",
        key: "assistant:resp-1",
        role: "assistant",
        text: "最终答复",
        mode: "replace",
        aliases: ["assistant:active"],
      },
      {
        type: "renameGroup",
        fromKey: "assistant-activity:live",
        toKey: "assistant-activity:resp-1",
      },
      {
        type: "finalizeGroup",
        groupKey: "assistant-activity:resp-1",
      },
    ]);
  });

  it("plans toolcall assistant updates as running transcript records with remembered args", () => {
    const state = createActivityControllerState();

    const plan = planMessageUpdateEffects(state, {
      responseId: "resp-2",
      assistantMessageEvent: {
        type: "toolcall_start",
        partial: {
          toolCallId: "call-2",
          content: [
            {
              type: "toolCall",
              name: "read",
              args: '{"path":"src/app.ts"}',
            },
          ],
        },
      },
    });

    expect(plan.effects).toEqual([
      {
        type: "renameGroup",
        fromKey: "assistant-thinking:live",
        toKey: "assistant-thinking:resp-2",
      },
      {
        type: "finalizeGroup",
        groupKey: "assistant-thinking:resp-2",
      },
      {
        type: "renameGroup",
        fromKey: "assistant-activity:live",
        toKey: "assistant-activity:resp-2",
      },
      {
        type: "rememberToolActivity",
        groupKey: "assistant-activity:resp-2",
        toolArgs: '{"path":"src/app.ts"}',
        toolCallId: "call-2",
      },
      {
        type: "recordTranscript",
        update: {
          groupKey: "assistant-activity:resp-2",
          entryKey: "call-2",
          status: "running",
          label: "读取：src/app.ts",
          detail: '{"path":"src/app.ts"}',
          detailSummary: "查看参数",
          family: "tool",
        },
      },
    ]);
  });

  it("plans tool execution end as a finished command transcript entry", () => {
    const state = createActivityControllerState();

    const plan = planToolExecutionEffects(
      state,
      {
        responseId: "resp-3",
        toolName: "exec_command",
        toolCallId: "call-3",
        args: { command: "npm test" },
        result: {
          content: [{ type: "text", text: "PASS" }],
        },
      },
      "tool_execution_end",
    );

    expect(plan.effects).toEqual([
      {
        type: "renameGroup",
        fromKey: "assistant-activity:live",
        toKey: "assistant-activity:resp-3",
      },
      {
        type: "rememberToolActivity",
        groupKey: "assistant-activity:resp-3",
        toolArgs: '{\n  "command": "npm test"\n}',
        toolCallId: "call-3",
      },
      {
        type: "recordTranscript",
        update: {
          groupKey: "assistant-activity:resp-3",
          entryKey: "call-3",
          status: "done",
          label: "bash：npm test",
          detail: "PASS",
          detailSummary: "查看命令输出",
          family: "command",
        },
      },
    ]);
  });

  it("uses remembered tool args when tool result messages omit args", () => {
    const state = createActivityControllerState();
    rememberToolActivity(state, {
      groupKey: "assistant-activity:resp-4",
      toolArgs: '{"path":"README.md"}',
      toolCallId: "call-4",
    });

    const plan = planMessageEndEffects(state, {
      responseId: "resp-4",
      message: {
        role: "toolResult",
        toolName: "read",
        toolCallId: "call-4",
        content: [{ type: "text", text: "line 1\nline 2" }],
      },
    });

    expect(plan.effects).toEqual([
      {
        type: "recordTranscript",
        update: {
          groupKey: "assistant-activity:resp-4",
          entryKey: "call-4",
          status: "done",
          label: "读取：README.md",
          detail: "line 1\nline 2",
          detailSummary: "查看详情",
          family: "tool",
        },
      },
    ]);
  });

  it("plans history assistant messages with thinking transcript and assistant feed text", () => {
    const plan = planHistoryMessageEffects(
      {
        role: "assistant",
        responseId: "resp-5",
        content: [
          { type: "thinking", thinking: "先分析" },
          { type: "text", text: "后回答" },
        ],
      },
      4,
    );

    expect(plan.effects).toEqual([
      {
        type: "recordTranscript",
        update: {
          groupKey: "history:thinking:resp-5",
          entryKey: "resp-5:thinking",
          status: "done",
          label: "思考：先分析",
          family: "thinking",
        },
      },
      {
        type: "finalizeGroup",
        groupKey: "history:thinking:resp-5",
      },
      {
        type: "feedMessage",
        key: "resp-5",
        role: "assistant",
        text: "后回答",
        mode: "replace",
      },
    ]);
  });
});
