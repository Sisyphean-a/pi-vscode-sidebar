import { describe, expect, it } from "vitest";
import {
  createActivityControllerState,
  nextInlineNoteKey,
  readStoredToolArgs,
  rememberToolActivity,
  resolveAssistantActivityGroup,
  resolveAssistantStreamKey,
  resolveThinkingActivityGroup,
  resolveThinkingEntryKey,
  resolveToolActivityGroup,
  resolveToolEntryKey,
  resolveToolResultEntryKey,
} from "../../../src/view/webview/activity-controller-state.ts";

describe("activity controller state", () => {
  it("remembers tool call group and args across later result events", () => {
    const state = createActivityControllerState();

    expect(
      resolveToolActivityGroup(state, {
        responseId: "resp-1",
        toolCallId: "call-1",
      }),
    ).toEqual({
      groupKey: "assistant-activity:resp-1",
      renameFrom: "assistant-activity:live",
    });

    rememberToolActivity(state, {
      groupKey: "assistant-activity:resp-1",
      toolArgs: '{"path":"src/app.ts"}',
      toolCallId: "call-1",
    });

    expect(readStoredToolArgs(state, "call-1")).toBe('{"path":"src/app.ts"}');
    expect(
      resolveToolActivityGroup(state, {
        responseId: "resp-2",
        toolCallId: "call-1",
      }),
    ).toEqual({
      groupKey: "assistant-activity:resp-1",
    });
    expect(
      resolveToolEntryKey({
        responseId: "resp-2",
        toolCallId: "call-1",
        toolName: "read",
      }),
    ).toBe("call-1");
    expect(
      resolveToolResultEntryKey({
        toolCallId: "call-1",
        toolName: "read",
      }),
    ).toBe("call-1");
  });

  it("uses live keys before response ids resolve and increments inline note keys", () => {
    const state = createActivityControllerState();

    expect(nextInlineNoteKey(state)).toBe("note:1");
    expect(nextInlineNoteKey(state)).toBe("note:2");
    expect(resolveAssistantActivityGroup()).toEqual({
      groupKey: "assistant-activity:live",
    });
    expect(resolveAssistantStreamKey()).toBe("assistant:active");
    expect(resolveThinkingActivityGroup()).toEqual({
      groupKey: "assistant-thinking:live",
    });
    expect(resolveThinkingEntryKey()).toBe("live:thinking");
  });
});
