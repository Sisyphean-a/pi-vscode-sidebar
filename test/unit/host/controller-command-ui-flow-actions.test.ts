import { describe, expect, it } from "vitest";

import {
  resolveCommandUiOpenPlan,
  resolvePendingCommandUiAction,
  toResumeCommandUiItems,
} from "../../../src/host/command/ui/actions.ts";

describe("controller command ui flow actions", () => {
  it("builds the correct open plans for resume and tree commands", () => {
    expect(resolveCommandUiOpenPlan("resume", "/resume")).toEqual({
      type: "resume",
      kind: "resume",
      rawInput: "/resume",
      requestKind: "session_list",
    });

    expect(resolveCommandUiOpenPlan("tree", "/tree")).toMatchObject({
      type: "rpc",
      kind: "tree",
      rawInput: "/tree",
      requestKind: "session_tree",
      emptyMessage: "没有可切换的树节点",
      errorMessage: "获取会话树失败",
      command: { type: "get_session_tree" },
    });
  });

  it("resolves model selection actions against the current phase", () => {
    expect(
      resolvePendingCommandUiAction(
        { kind: "model", rawInput: "/model" },
        { provider: "openai", modelId: "gpt-5" },
        "streaming",
      ),
    ).toEqual({
      type: "command",
      phase: "streaming",
      command: {
        type: "set_model",
        provider: "openai",
        modelId: "gpt-5",
      },
    });

    expect(
      resolvePendingCommandUiAction({ kind: "model", rawInput: "/model" }, {}, "idle"),
    ).toEqual({
      type: "error",
      message: "模型选择无效",
      restoreInput: "/model",
    });
  });

  it("resolves tree responses and maps resume items", () => {
    expect(
      resolvePendingCommandUiAction(
        { kind: "tree", rawInput: "/tree" },
        { selectedId: "node-1" },
        "idle",
      ),
    ).toEqual({
      type: "command",
      phase: "idle",
      command: {
        type: "navigate_session_tree",
        entryId: "node-1",
      },
    });

    expect(
      toResumeCommandUiItems([
        {
          sessionId: "session-1",
          sessionPath: "/tmp/session-1.jsonl",
          title: "最近会话",
          updatedAt: "2026-05-27 20:30",
        },
      ]),
    ).toEqual([
      {
        id: "/tmp/session-1.jsonl",
        label: "最近会话",
        detail: "2026-05-27 20:30",
        payload: { selectedId: "/tmp/session-1.jsonl" },
      },
    ]);
  });
});
