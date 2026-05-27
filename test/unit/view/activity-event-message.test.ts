import { describe, expect, it } from "vitest";
import {
  formatEventMessage,
  mapStatusLabel,
} from "../../../src/view/webview/activity-event-message.ts";

describe("activity event message", () => {
  it("maps sidebar status keys to current chinese labels", () => {
    expect(mapStatusLabel("idle")).toBe("空闲");
    expect(mapStatusLabel("streaming")).toBe("生成中");
    expect(mapStatusLabel("awaiting_extension_ui")).toBe("等待确认");
    expect(mapStatusLabel("process_dead")).toBe("进程异常");
    expect(mapStatusLabel("connected")).toBe("已连接");
    expect(mapStatusLabel("other")).toBe("状态更新");
  });

  it("formats assistant/tool activity events with the current wording", () => {
    expect(
      formatEventMessage({
        type: "message_update",
        assistantMessageEvent: {
          type: "toolcall_start",
          partial: {
            content: [{ type: "toolCall", name: "read" }],
          },
        },
      }),
    ).toBe("助手思考中（调用 read）");

    expect(
      formatEventMessage({
        type: "message_end",
        message: {
          role: "toolResult",
          toolName: "read",
        },
      }),
    ).toBe("工具结果已返回：read");

    expect(
      formatEventMessage({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "这是助手回复" }],
        },
      }),
    ).toBe("助手：这是助手回复");
  });

  it("falls back to generic messages for query results and unknown payloads", () => {
    expect(formatEventMessage({ type: "query_result" })).toBe("查询结果已返回");
    expect(formatEventMessage({ type: "unknown" })).toBe("收到事件更新");
    expect(formatEventMessage("plain text")).toBe('"plain text"');
  });
});
