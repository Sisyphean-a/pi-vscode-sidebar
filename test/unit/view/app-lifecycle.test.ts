// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createAppLifecycle } from "../../../src/view/webview/app/lifecycle.ts";

describe("app lifecycle", () => {
  it("syncs streaming chrome state to send/new-session controls", () => {
    const harness = createHarness();
    const lifecycle = createAppLifecycle(harness.options);

    expect(lifecycle.isStreamingPhase()).toBe(false);
    expect(harness.newSessionButton.disabled).toBe(false);
    expect(harness.sendButton.dataset.mode).toBe("send");
    expect(harness.sendButton.title).toBe("发送消息");

    lifecycle.setStreamingPhase(true);

    expect(lifecycle.isStreamingPhase()).toBe(true);
    expect(harness.newSessionButton.disabled).toBe(true);
    expect(harness.sendButton.dataset.mode).toBe("stop");
    expect(harness.sendButton.title).toBe("停止生成");
  });

  it("resets composer when starting a fresh session or replaying history", () => {
    const harness = createHarness();
    const lifecycle = createAppLifecycle(harness.options);

    lifecycle.startFreshConversation();
    expect(harness.startFreshConversation).toHaveBeenCalledTimes(1);
    expect(harness.imageClear).toHaveBeenCalledTimes(1);
    expect(harness.resetComposerHeight).toHaveBeenCalledTimes(1);
    expect(harness.promptInput.value).toBe("");

    harness.promptInput.value = "another prompt";
    lifecycle.beginConversationReplay();
    expect(harness.beginConversationReplay).toHaveBeenCalledTimes(1);
    expect(harness.imageClear).toHaveBeenCalledTimes(2);
    expect(harness.resetComposerHeight).toHaveBeenCalledTimes(2);
    expect(harness.promptInput.value).toBe("");
  });
});

function createHarness() {
  document.body.innerHTML = `
    <button id="new-session"></button>
    <button id="send"></button>
    <textarea id="prompt">pending input</textarea>
  `;
  const newSessionButton = expectElement<HTMLButtonElement>("new-session");
  const sendButton = expectElement<HTMLButtonElement>("send");
  const promptInput = expectElement<HTMLTextAreaElement>("prompt");
  const beginConversationReplay = vi.fn();
  const startFreshConversation = vi.fn();
  const imageClear = vi.fn();
  const resetComposerHeight = vi.fn();
  return {
    beginConversationReplay,
    imageClear,
    newSessionButton,
    options: {
      conversationPage: {
        beginConversationReplay,
        startFreshConversation,
      },
      imageAttachmentController: {
        clear: imageClear,
      },
      newSessionButton,
      promptInput,
      resetComposerHeight,
      sendButton,
    },
    promptInput,
    resetComposerHeight,
    sendButton,
    startFreshConversation,
  };
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
