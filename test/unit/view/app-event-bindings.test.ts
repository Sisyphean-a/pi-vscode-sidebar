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
      composerInput: createComposerInputEventPort(
        document.getElementById("prompt-input") as HTMLTextAreaElement,
        vi.fn(),
      ),
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
      messageFeed: createMessageFeedEventPort(document.getElementById("message-feed") as HTMLElement),
      newSessionButton: createClickEventPort(
        document.getElementById("new-session-button") as HTMLButtonElement,
      ),
      onAbort,
      onNewSession: vi.fn(),
      scrollToBottomButton: createClickEventPort(
        document.getElementById("scroll-to-bottom-button") as HTMLButtonElement,
      ),
      sendButton: createClickEventPort(document.getElementById("send-button") as HTMLButtonElement),
    });

    (document.getElementById("send-button") as HTMLButtonElement).click();

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(composerActions.sendPrompt).not.toHaveBeenCalled();
  });
});

function createClickEventPort(button: HTMLButtonElement) {
  return {
    addClickListener(listener: () => void) {
      button.addEventListener("click", listener);
    },
  };
}

function createComposerInputEventPort(promptInput: HTMLTextAreaElement, syncHeight: () => void) {
  return {
    addInputListener(listener: () => void) {
      promptInput.addEventListener("input", listener);
    },
    addKeydownListener(listener: (event: KeyboardEvent) => void) {
      promptInput.addEventListener("keydown", listener);
    },
    addPasteListener(listener: (event: ClipboardEvent | Event) => void) {
      promptInput.addEventListener("paste", listener);
    },
    getValue() {
      return promptInput.value;
    },
    syncHeight,
  };
}

function createMessageFeedEventPort(messageFeed: HTMLElement) {
  return {
    addClickListener(listener: (event: MouseEvent) => void) {
      messageFeed.addEventListener("click", listener);
    },
    addScrollListener(listener: () => void) {
      messageFeed.addEventListener("scroll", listener);
    },
  };
}
