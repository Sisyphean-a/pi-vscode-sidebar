import { describe, expect, it } from "vitest";
import {
  formatEventMessage,
  mapStatusLabel,
} from "../../../src/view/webview/activity-event-message.ts";

describe("activity event message formatter", () => {
  it("formats tool execution progress with tool name", () => {
    expect(
      formatEventMessage({
        type: "tool_execution_start",
        toolName: "read_file",
      }),
    ).toBe("工具开始执行：read_file");
  });

  it("formats toolcall delta and thinking states", () => {
    expect(
      formatEventMessage({
        type: "message_update",
        assistantMessageEvent: {
          type: "toolcall_update",
          partial: { content: [{ type: "toolCall", name: "grep" }] },
        },
      }),
    ).toBe("助手思考中（调用 grep）");

    expect(
      formatEventMessage({
        type: "message_update",
        message: { content: [{ type: "thinking", thinking: "..." }] },
      }),
    ).toBe("助手思考中");
  });

  it("maps status labels for known and unknown keys", () => {
    expect(mapStatusLabel("streaming")).toBe("生成中");
    expect(mapStatusLabel("custom")).toBe("状态更新");
  });
});
