import { describe, expect, it } from "vitest";

import {
  buildRuntimeQueryResultEvent,
  buildRuntimeStateMessage,
  shouldEmitRuntimeQueryResult,
  shouldReplayRuntimeMessages,
  withRuntimeCommandId,
} from "../../../src/host/controller-runtime-flow-support.ts";

describe("controller runtime flow support", () => {
  it("adds correlation id to rpc commands only when command id is missing", () => {
    expect(withRuntimeCommandId({ type: "get_available_models" }, "cid-1")).toEqual({
      type: "get_available_models",
      id: "cid-1",
    });
    expect(withRuntimeCommandId({ type: "get_available_models", id: "rpc-1" }, "cid-1")).toEqual({
      type: "get_available_models",
      id: "rpc-1",
    });
    expect(withRuntimeCommandId({ type: "get_available_models" }, undefined)).toEqual({
      type: "get_available_models",
    });
  });

  it("builds state and query result messages with the current payload shape", () => {
    expect(
      buildRuntimeStateMessage(
        { phase: "idle", updatedAt: 1 },
        {
          sessionId: "session-1",
          thinkingLevel: "medium",
          isStreaming: false,
          messageCount: 1,
          pendingMessageCount: 0,
        },
        [{ sessionId: "session-2", sessionPath: "s2", title: "Recent", updatedAt: "now" }],
      ),
    ).toEqual({
      type: "state",
      data: {
        view: { phase: "idle", updatedAt: 1 },
        rpc: {
          sessionId: "session-1",
          thinkingLevel: "medium",
          isStreaming: false,
          messageCount: 1,
          pendingMessageCount: 0,
        },
        recentSessions: [
          { sessionId: "session-2", sessionPath: "s2", title: "Recent", updatedAt: "now" },
        ],
      },
    });

    expect(buildRuntimeQueryResultEvent("set_model", { ok: true }, "cid-2")).toEqual({
      type: "event",
      data: {
        type: "query_result",
        command: "set_model",
        data: { ok: true },
        correlationId: "cid-2",
      },
    });
  });

  it("keeps command follow-up policies explicit", () => {
    expect(shouldEmitRuntimeQueryResult("set_model")).toBe(true);
    expect(shouldEmitRuntimeQueryResult("set_thinking_level")).toBe(true);
    expect(shouldEmitRuntimeQueryResult("clone")).toBe(false);

    expect(shouldReplayRuntimeMessages("new_session")).toBe(true);
    expect(shouldReplayRuntimeMessages("switch_session")).toBe(true);
    expect(shouldReplayRuntimeMessages("navigate_session_tree")).toBe(true);
    expect(shouldReplayRuntimeMessages("set_model")).toBe(false);
  });
});
