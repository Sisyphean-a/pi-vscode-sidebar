import { describe, expect, it } from "vitest";
import { resolveConversationPageEvent } from "../../../src/view/webview/conversation-page-events.ts";

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

  it("routes activity updates, tool execution events, and handled no-op events", () => {
    expect(resolveConversationPageEvent({ type: "message_update", text: "hello" })).toEqual({
      kind: "activityMessageUpdate",
      event: { type: "message_update", text: "hello" },
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
