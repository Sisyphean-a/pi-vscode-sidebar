import { describe, expect, it } from "vitest";
import {
  extractAssistantText,
  extractMessageText,
  extractThinkingText,
  readResponseId,
  readToolCallIdFromEvent,
  readToolNameFromEvent,
} from "../../../src/view/webview/features/activity/event-readers.ts";

describe("activity event readers", () => {
  it("extracts assistant text from structured message content", () => {
    const event = {
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "line-1" },
          { type: "text", text: "line-2" },
        ],
      },
    };

    expect(extractAssistantText(event)).toBe("line-1\n\nline-2");
    expect(extractMessageText(event.message)).toBe("line-1\n\nline-2");
  });

  it("extracts thinking text from assistant partial content", () => {
    const event = {
      assistantMessageEvent: {
        partial: {
          content: [{ type: "thinking", thinking: "正在分析" }],
        },
      },
    };

    expect(extractThinkingText(event)).toBe("正在分析");
  });

  it("reads response and tool identifiers from event fallbacks", () => {
    const event = {
      message: {
        responseId: "resp-1",
        content: [{ type: "toolCall", id: "tc-1", name: "read_file" }],
      },
    };

    expect(readResponseId(event)).toBe("resp-1");
    expect(readToolCallIdFromEvent(event)).toBe("tc-1");
    expect(readToolNameFromEvent(event)).toBe("read_file");
  });
});
