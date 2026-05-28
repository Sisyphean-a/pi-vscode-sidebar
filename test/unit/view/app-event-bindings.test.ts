// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { bindAppEventBindings } from "../../../src/view/webview/app/event-bindings.ts";

describe("app event bindings", () => {
  it("posts abort instead of sending a prompt while streaming", () => {
    document.body.innerHTML = `
      <button id="send-button"></button>
      <button id="new-session-button"></button>
      <button id="scroll-to-bottom-button"></button>
      <textarea id="prompt-input"></textarea>
      <div id="message-feed"></div>
    `;

    const onAbort = vi.fn();
    const composerActions = {
      handleCommandPaletteKeydown: vi.fn(() => false),
      sendPrompt: vi.fn(),
      shouldSubmitCommand: vi.fn(() => false),
      submitCommand: vi.fn(),
    };

    bindAppEventBindings({
      commandPalette: {
        update: vi.fn(),
      },
      commandUi: {
        clearResult: vi.fn(),
        handleKeydown: vi.fn(() => false),
      },
      composerActions,
      getIsStreamingPhase: () => true,
      handleHostMessage: vi.fn(),
      handleMessageFeedClick: vi.fn(),
      handleMessageFeedScroll: vi.fn(),
      handlePromptPaste: vi.fn(),
      handleScrollToBottom: vi.fn(),
      messageFeed: document.getElementById("message-feed") as HTMLElement,
      newSessionButton: document.getElementById("new-session-button") as HTMLButtonElement,
      onAbort,
      onNewSession: vi.fn(),
      promptInput: document.getElementById("prompt-input") as HTMLTextAreaElement,
      scrollToBottomButton: document.getElementById("scroll-to-bottom-button") as HTMLButtonElement,
      sendButton: document.getElementById("send-button") as HTMLButtonElement,
      syncComposerHeight: vi.fn(),
    });

    (document.getElementById("send-button") as HTMLButtonElement).click();

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(composerActions.sendPrompt).not.toHaveBeenCalled();
  });
});
