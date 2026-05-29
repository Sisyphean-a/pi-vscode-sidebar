// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createActivityController } from "../../../src/view/webview/features/activity/controller.ts";
import { applyConversationReplayQueryResult } from "../../../src/view/webview/features/conversation/page-effects.ts";
import { createConversationPageState } from "../../../src/view/webview/features/conversation/page-state.ts";
import { createConversationFeed } from "../../../src/view/webview/features/conversation/feed.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("conversation and activity rendering", () => {
  it("hydrates replayed history messages without leaving an empty activity slot", () => {
    const messageContainer = document.createElement("section");
    const conversationFeed = createConversationFeed({
      view: createPreactRenderPort(messageContainer),
      onChange() {},
      renderAssistantMarkdown(text) {
        return text;
      },
      renderPlainTextWithReferences(text) {
        return text;
      },
    });
    const activityController = createActivityController({
      view: createPreactRenderPort(document.createElement("section")),
      resolveView() {
        return conversationFeed.findInlineActivitySlotView();
      },
      conversationFeed,
      onChange: vi.fn(),
    });
    const state = createConversationPageState();

    applyConversationReplayQueryResult({
      activityController,
      messages: [
        {
          id: "user-1",
          role: "user",
          content: [{ type: "text", text: "hi" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
        },
      ],
      replace: true,
      resetConversationView() {
        conversationFeed.reset();
        activityController.reset();
      },
      state,
      syncRecentSessionsVisibility: vi.fn(),
    });

    expect(messageContainer.textContent).toContain("hi");
    expect(messageContainer.textContent).toContain("hello");
    expect(readDirectChildren(messageContainer)).toEqual([
      "chat-message role-user",
      "chat-message role-assistant",
    ]);
  });

  it("renders activity between the current user message and the assistant reply", () => {
    const messageContainer = document.createElement("section");
    const conversationFeed = createConversationFeed({
      view: createPreactRenderPort(messageContainer),
      onChange() {},
      renderAssistantMarkdown(text) {
        return text;
      },
      renderPlainTextWithReferences(text) {
        return text;
      },
    });
    const activityController = createActivityController({
      view: createPreactRenderPort(document.createElement("section")),
      resolveView() {
        return conversationFeed.findInlineActivitySlotView();
      },
      conversationFeed,
      onChange: vi.fn(),
    });

    conversationFeed.setMessageText("user-1", "user", "hi", "replace");
    activityController.applyMessageStart({
      type: "message_start",
      message: { role: "assistant", content: [] },
    });

    expect(messageContainer.textContent).toContain("hi");
    expect(messageContainer.textContent).toContain("已处理 0s");
    expect(readDirectChildren(messageContainer)).toEqual(["chat-message role-user", "activity-slot"]);

    activityController.applyMessageUpdate({
      type: "message_update",
      responseId: "resp-1",
      text: "hello",
    });

    expect(messageContainer.textContent).toContain("hi");
    expect(messageContainer.textContent).toContain("hello");
    expect(messageContainer.textContent).toContain("已处理");
    expect(readDirectChildren(messageContainer)).toEqual([
      "chat-message role-user",
      "activity-slot",
      "chat-message role-assistant",
    ]);

    activityController.applyAgentEnd({ type: "agent_end" });

    expect(messageContainer.textContent).toContain("hi");
    expect(messageContainer.textContent).toContain("hello");
    expect(messageContainer.textContent).not.toContain("已处理");
  });
});

function readDirectChildren(container: HTMLElement): string[] {
  return Array.from(container.children).map((child) => {
    if (!(child instanceof HTMLElement)) return child.tagName.toLowerCase();
    if (child.dataset.inlineActivitySlot === "true") return "activity-slot";
    return child.className;
  });
}
