// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActivityController } from "../../../src/view/webview/features/activity/controller.ts";

describe("activity controller processing status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T10:12:59.043Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows assistant processing status before the first token and clears it on agent end", () => {
    const container = document.createElement("section");
    const controller = createActivityController({
      container,
      conversationFeed: createConversationFeedStub(),
      onChange: vi.fn(),
    });

    controller.applyMessageStart({
      type: "message_start",
      message: {
        role: "assistant",
        content: [],
      },
    });

    expect(container.textContent).toContain("已处理 0s");

    vi.advanceTimersByTime(5000);

    expect(container.textContent).toContain("已处理 5s");

    controller.applyAgentEnd({ type: "agent_end" });

    expect(container.textContent).not.toContain("已处理");
  });

  it("ignores user message start events", () => {
    const container = document.createElement("section");
    const controller = createActivityController({
      container,
      conversationFeed: createConversationFeedStub(),
      onChange: vi.fn(),
    });

    controller.applyMessageStart({
      type: "message_start",
      message: {
        role: "user",
        content: [],
      },
    });

    expect(container.textContent).not.toContain("已处理");
  });
});

function createConversationFeedStub() {
  return {
    attachImagesToMessage: vi.fn(),
    ensureInlineActivitySlot: vi.fn(() => document.createElement("section")),
    findInlineActivitySlot: vi.fn(() => null),
    moveInlineActivitySlotToEnd: vi.fn(() => document.createElement("section")),
    reset: vi.fn(),
    setMessageText: vi.fn(),
  };
}
