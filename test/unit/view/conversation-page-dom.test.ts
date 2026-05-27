// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  hasConversationContent,
  handleConversationPageFeedClick,
  isNearBottom,
  scrollConversationFeedToBottom,
} from "../../../src/view/webview/conversation-page-dom.ts";

describe("conversation page dom", () => {
  it("opens file references when clicking a file reference chip", () => {
    document.body.innerHTML = `
      <button class="file-reference-chip" data-path="src/view/provider.ts" data-start-line="8" data-end-line="12">
        <span id="inner">open</span>
      </button>
    `;
    const onOpenFileReference = vi.fn();
    const target = document.getElementById("inner") as HTMLElement;

    handleConversationPageFeedClick(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
      target,
      onOpenFileReference,
    );

    expect(onOpenFileReference).toHaveBeenCalledWith("src/view/provider.ts", 8, 12);
  });

  it("scrolls the feed to the bottom when allowed", () => {
    const messageFeed = document.createElement("div");
    Object.defineProperty(messageFeed, "scrollHeight", { configurable: true, value: 240 });
    messageFeed.scrollTop = 10;
    const updateScrollToBottomButton = vi.fn();

    scrollConversationFeedToBottom({
      force: false,
      messageFeed,
      shouldScroll: true,
      updateScrollToBottomButton,
    });

    expect(messageFeed.scrollTop).toBe(240);
    expect(updateScrollToBottomButton).toHaveBeenCalledTimes(1);
  });

  it("keeps the current scroll position when auto scroll is disabled", () => {
    const messageFeed = document.createElement("div");
    Object.defineProperty(messageFeed, "scrollHeight", { configurable: true, value: 240 });
    messageFeed.scrollTop = 10;
    const updateScrollToBottomButton = vi.fn();

    scrollConversationFeedToBottom({
      force: false,
      messageFeed,
      shouldScroll: false,
      updateScrollToBottomButton,
    });

    expect(messageFeed.scrollTop).toBe(10);
    expect(updateScrollToBottomButton).toHaveBeenCalledTimes(1);
  });

  it("treats extension ui visibility as conversation content", () => {
    const messageFeed = document.createElement("div");
    const extensionUiPanel = document.createElement("div");

    expect(hasConversationContent(messageFeed, extensionUiPanel)).toBe(true);
    extensionUiPanel.classList.add("hidden");
    expect(hasConversationContent(messageFeed, extensionUiPanel)).toBe(false);

    messageFeed.append(document.createElement("article"));
    expect(hasConversationContent(messageFeed, extensionUiPanel)).toBe(true);
  });

  it("detects when the feed is near the bottom using the current threshold", () => {
    const messageFeed = document.createElement("div");
    Object.defineProperty(messageFeed, "scrollHeight", { configurable: true, value: 300 });
    Object.defineProperty(messageFeed, "clientHeight", { configurable: true, value: 100 });
    messageFeed.scrollTop = 184;

    expect(isNearBottom(messageFeed)).toBe(true);

    messageFeed.scrollTop = 150;
    expect(isNearBottom(messageFeed)).toBe(false);
  });
});
