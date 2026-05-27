import { describe, expect, it } from "vitest";
import {
  extractThinkingText,
  readResponseId,
} from "../../../src/view/webview/activity-event-readers.ts";

describe("activity event readers", () => {
  it("reads response id from direct field, message, or partial payload", () => {
    expect(readResponseId({ responseId: "resp-direct" })).toBe("resp-direct");
    expect(readResponseId({ message: { responseId: "resp-message" } })).toBe("resp-message");
    expect(
      readResponseId({
        assistantMessageEvent: {
          partial: { responseId: "resp-partial" },
        },
      }),
    ).toBe("resp-partial");
  });

  it("prefers thinking text from partial content before delta and message fallbacks", () => {
    expect(
      extractThinkingText({
        assistantMessageEvent: {
          delta: "delta text",
          partial: {
            content: [{ type: "thinking", thinking: "partial thinking" }],
          },
        },
        message: {
          content: [{ type: "thinking", thinking: "message thinking" }],
        },
      }),
    ).toBe("partial thinking");
  });
});
