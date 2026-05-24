import { describe, expect, it } from "vitest";
import { formatEventMessage } from "../../../src/view/webview/ui-text.ts";

describe("formatEventMessage", () => {
  it("reads assistant text from message_update partial payload", () => {
    const text = formatEventMessage({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        partial: {
          role: "assistant",
          content: [{ type: "text", text: "我是助手" }],
        },
      },
    });

    expect(text).toBe("助手：我是助手");
  });

  it("reads assistant text from message_end payload", () => {
    const text = formatEventMessage({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "最终答复" }],
      },
    });

    expect(text).toBe("助手：最终答复");
  });

  it("maps toolcall delta update to explicit tool progress text", () => {
    const text = formatEventMessage({
      type: "message_update",
      assistantMessageEvent: {
        type: "toolcall_delta",
        partial: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              name: "read",
            },
          ],
        },
      },
    });

    expect(text).toBe("助手思考中（调用 read）");
  });

  it("maps toolResult message_end to explicit tool result text", () => {
    const text = formatEventMessage({
      type: "message_end",
      message: {
        role: "toolResult",
        toolName: "read",
        content: [{ type: "text", text: "very long output..." }],
      },
    });

    expect(text).toBe("工具结果已返回：read");
  });
});
