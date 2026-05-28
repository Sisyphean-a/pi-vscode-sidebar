import { describe, expect, it } from "vitest";
import { resolveConversationPageEvent } from "../../../src/view/webview/features/conversation/page-events.ts";

describe("resolveConversationPageEvent", () => {
  it("resolves get_messages query results from nested payloads", () => {
    expect(
      resolveConversationPageEvent({
        type: "query_result",
        command: "get_messages",
        replace: true,
        data: {
          data: {
            messages: [{ role: "assistant", id: "m1" }],
          },
        },
      }),
    ).toEqual({
      kind: "messageReplayQueryResult",
      messages: [{ role: "assistant", id: "m1" }],
      replace: true,
    });
  });

  it("rejects get_messages query results when replace is not a boolean", () => {
    expect(
      resolveConversationPageEvent({
        type: "query_result",
        command: "get_messages",
        replace: "yes",
        data: {
          messages: [{ role: "assistant", id: "m1" }],
        },
      }),
    ).toBeUndefined();
  });

  it("resolves get_commands query results and filters invalid commands", () => {
    expect(
      resolveConversationPageEvent({
        type: "query_result",
        command: "get_commands",
        data: {
          commands: [
            {
              name: "resume",
              source: "prompt",
              sourceInfo: {
                path: "a",
                source: "prompt",
                scope: "project",
                origin: "repo",
              },
            },
            { name: "broken" },
          ],
        },
      }),
    ).toEqual({
      kind: "availableCommandsQueryResult",
      commands: [
        {
          name: "resume",
          source: "prompt",
          sourceInfo: {
            path: "a",
            source: "prompt",
            scope: "project",
            origin: "repo",
          },
        },
      ],
    });
  });

  it("drops get_commands entries with invalid rpc source enum", () => {
    expect(
      resolveConversationPageEvent({
        type: "query_result",
        command: "get_commands",
        data: {
          commands: [
            {
              name: "valid",
              source: "prompt",
              sourceInfo: {
                path: "a",
                source: "prompt",
                scope: "project",
                origin: "repo",
              },
            },
            {
              name: "invalid",
              source: "custom",
              sourceInfo: {
                path: "b",
                source: "custom",
                scope: "project",
                origin: "repo",
              },
            },
          ],
        },
      }),
    ).toEqual({
      kind: "availableCommandsQueryResult",
      commands: [
        {
          name: "valid",
          source: "prompt",
          sourceInfo: {
            path: "a",
            source: "prompt",
            scope: "project",
            origin: "repo",
          },
        },
      ],
    });
  });

  it("routes activity updates, tool execution events, and handled no-op events", () => {
    expect(
      resolveConversationPageEvent({
        type: "message_start",
        message: { role: "assistant", content: [] },
      }),
    ).toEqual({
      kind: "activityMessageStart",
      event: {
        type: "message_start",
        message: { role: "assistant", content: [] },
      },
    });
    expect(resolveConversationPageEvent({ type: "message_update", text: "hello" })).toEqual({
      kind: "activityMessageUpdate",
      event: { type: "message_update", text: "hello" },
    });
    expect(resolveConversationPageEvent({ type: "agent_end" })).toEqual({
      kind: "activityAgentEnd",
      event: { type: "agent_end" },
    });
    expect(resolveConversationPageEvent({ type: "tool_execution_end", toolName: "read" })).toEqual({
      kind: "toolExecutionEvent",
      event: { type: "tool_execution_end", toolName: "read" },
      eventType: "tool_execution_end",
    });
    expect(resolveConversationPageEvent({ type: "rpc_response" })).toEqual({
      kind: "handledNoop",
    });
  });
});
