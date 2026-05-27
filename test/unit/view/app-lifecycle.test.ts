// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createAppLifecycle } from "../../../src/view/webview/app-lifecycle.ts";

describe("app lifecycle", () => {
  it("switches send button chrome and disables new session while streaming", () => {
    document.body.innerHTML = `
      <button id="send-button"></button>
      <button id="new-session-button"></button>
      <textarea id="prompt-input"></textarea>
    `;

    const sendButton = document.getElementById("send-button") as HTMLButtonElement;
    const newSessionButton = document.getElementById("new-session-button") as HTMLButtonElement;
    const promptInput = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const lifecycle = createAppLifecycle({
      conversationPage: {
        beginConversationReplay() {},
        startFreshConversation() {},
      },
      imageAttachmentController: {
        clear: vi.fn(),
      },
      newSessionButton,
      promptInput,
      resetComposerHeight: vi.fn(),
      sendButton,
    });

    lifecycle.setStreamingPhase(true);

    expect(lifecycle.isStreamingPhase()).toBe(true);
    expect(newSessionButton.disabled).toBe(true);
    expect(sendButton.dataset.mode).toBe("stop");
    expect(sendButton.title).toBe("停止生成");
    expect(sendButton.getAttribute("aria-label")).toBe("停止生成");
  });
});
