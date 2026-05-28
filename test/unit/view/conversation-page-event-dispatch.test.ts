import { describe, expect, it, vi } from "vitest";

import { dispatchConversationPageEvent } from "../../../src/view/webview/features/conversation/page-event-dispatch.ts";

describe("dispatchConversationPageEvent", () => {
  it("forwards activity message updates to the activity controller", () => {
    const applyMessageUpdate = vi.fn();

    dispatchConversationPageEvent({
      activityController: {
        applyAgentEnd: vi.fn(),
        applyMessageEnd: vi.fn(),
        applyMessageStart: vi.fn(),
        applyMessageUpdate,
        applyToolExecutionEvent: vi.fn(),
      },
      applyMessageReplayQueryResult: vi.fn(),
      event: {
        kind: "activityMessageUpdate",
        event: { type: "message_update", id: "msg-1" },
      },
      onDynamicCommandsChange: vi.fn(),
    });

    expect(applyMessageUpdate).toHaveBeenCalledWith({ type: "message_update", id: "msg-1" });
  });

  it("maps available command query results before notifying the consumer", () => {
    const onDynamicCommandsChange = vi.fn();

    dispatchConversationPageEvent({
      activityController: {
        applyAgentEnd: vi.fn(),
        applyMessageEnd: vi.fn(),
        applyMessageStart: vi.fn(),
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
      },
      applyMessageReplayQueryResult: vi.fn(),
      event: {
        kind: "availableCommandsQueryResult",
        commands: [
          {
            name: "resume",
            description: "resume session",
            source: "extension",
            sourceInfo: {
              path: "ext.ts",
              source: "local",
              scope: "user",
              origin: "repo",
            },
          },
        ],
      },
      onDynamicCommandsChange,
    });

    expect(onDynamicCommandsChange).toHaveBeenCalledWith([
      {
        id: "resume",
        name: "resume",
        description: "resume session",
        source: "extension",
        sourceBadge: "[u]",
        aliases: ["resume"],
      },
    ]);
  });

  it("forwards replay query results to the replay handler", () => {
    const applyMessageReplayQueryResult = vi.fn();

    dispatchConversationPageEvent({
      activityController: {
        applyAgentEnd: vi.fn(),
        applyMessageEnd: vi.fn(),
        applyMessageStart: vi.fn(),
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
      },
      applyMessageReplayQueryResult,
      event: {
        kind: "messageReplayQueryResult",
        messages: [{ role: "assistant", id: "msg-1" }],
        replace: true,
      },
      onDynamicCommandsChange: vi.fn(),
    });

    expect(applyMessageReplayQueryResult).toHaveBeenCalledWith(
      [{ role: "assistant", id: "msg-1" }],
      true,
    );
  });

  it("forwards assistant lifecycle events to the activity controller", () => {
    const applyMessageStart = vi.fn();
    const applyAgentEnd = vi.fn();

    dispatchConversationPageEvent({
      activityController: {
        applyAgentEnd,
        applyMessageEnd: vi.fn(),
        applyMessageStart,
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
      },
      applyMessageReplayQueryResult: vi.fn(),
      event: {
        kind: "activityMessageStart",
        event: { type: "message_start", message: { role: "assistant", content: [] } },
      },
      onDynamicCommandsChange: vi.fn(),
    });

    dispatchConversationPageEvent({
      activityController: {
        applyAgentEnd,
        applyMessageEnd: vi.fn(),
        applyMessageStart,
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
      },
      applyMessageReplayQueryResult: vi.fn(),
      event: {
        kind: "activityAgentEnd",
        event: { type: "agent_end" },
      },
      onDynamicCommandsChange: vi.fn(),
    });

    expect(applyMessageStart).toHaveBeenCalledWith({
      type: "message_start",
      message: { role: "assistant", content: [] },
    });
    expect(applyAgentEnd).toHaveBeenCalledWith({ type: "agent_end" });
  });

  it("ignores handled no-op events", () => {
    const applyMessageReplayQueryResult = vi.fn();
    const onDynamicCommandsChange = vi.fn();
    const activityController = {
      applyAgentEnd: vi.fn(),
      applyMessageEnd: vi.fn(),
      applyMessageStart: vi.fn(),
      applyMessageUpdate: vi.fn(),
      applyToolExecutionEvent: vi.fn(),
    };

    dispatchConversationPageEvent({
      activityController,
      applyMessageReplayQueryResult,
      event: { kind: "handledNoop" },
      onDynamicCommandsChange,
    });

    expect(activityController.applyMessageUpdate).not.toHaveBeenCalled();
    expect(activityController.applyMessageEnd).not.toHaveBeenCalled();
    expect(activityController.applyMessageStart).not.toHaveBeenCalled();
    expect(activityController.applyAgentEnd).not.toHaveBeenCalled();
    expect(activityController.applyToolExecutionEvent).not.toHaveBeenCalled();
    expect(applyMessageReplayQueryResult).not.toHaveBeenCalled();
    expect(onDynamicCommandsChange).not.toHaveBeenCalled();
  });
});
