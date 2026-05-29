// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createConversationPageFlow } from "../../../src/view/webview/features/conversation/page-flow.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("conversation page flow", () => {
  it("opens file reference when clicking a rendered reference chip", () => {
    const onOpenFileReference = vi.fn();
    const messageFeed = document.createElement("section");
    const chip = document.createElement("button");
    chip.className = "file-reference-chip";
    chip.dataset.path = "src/a.ts";
    chip.dataset.startLine = "12";
    chip.dataset.endLine = "15";
    messageFeed.append(chip);

    const flow = createConversationPageFlow({
      activityController: {
        applyAgentEnd: vi.fn(),
        appendInlineNote: vi.fn(),
        applyMessageEnd: vi.fn(),
        applyMessageStart: vi.fn(),
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
        hydrateHistoryMessage: vi.fn(),
        reset: vi.fn(),
      },
      conversationFeed: {
        attachImagesToMessage: vi.fn(),
        findInlineActivitySlotView: vi.fn(() => undefined),
        moveInlineActivitySlotToEnd: vi.fn(() =>
          createPreactRenderPort(document.createElement("section")),
        ),
        reset: vi.fn(),
        setMessageText: vi.fn(),
      },
      isExtensionUiVisible: () => false,
      onDynamicCommandsChange: vi.fn(),
      onOpenFileReference,
      onStreamingPhaseChange: vi.fn(),
      recentSessionsPanel: {
        setVisible: vi.fn(),
        update: vi.fn(),
      },
      resetExtensionUi: vi.fn(),
      setScrollToBottomVisible: vi.fn(),
      viewport: createConversationViewportHarness(messageFeed),
    });

    const clickEvent = { target: chip } as unknown as MouseEvent;
    flow.handleMessageFeedClick(clickEvent);

    expect(onOpenFileReference).toHaveBeenCalledWith("src/a.ts", 12, 15);
  });

  it("syncs recent sessions visibility after starting a fresh conversation", () => {
    const recentSessionsPanel = {
      setVisible: vi.fn(),
      update: vi.fn(),
    };
    const flow = createConversationPageFlow({
      activityController: {
        applyAgentEnd: vi.fn(),
        appendInlineNote: vi.fn(),
        applyMessageEnd: vi.fn(),
        applyMessageStart: vi.fn(),
        applyMessageUpdate: vi.fn(),
        applyToolExecutionEvent: vi.fn(),
        hydrateHistoryMessage: vi.fn(),
        reset: vi.fn(),
      },
      conversationFeed: {
        attachImagesToMessage: vi.fn(),
        findInlineActivitySlotView: vi.fn(() => undefined),
        moveInlineActivitySlotToEnd: vi.fn(() =>
          createPreactRenderPort(document.createElement("section")),
        ),
        reset: vi.fn(),
        setMessageText: vi.fn(),
      },
      isExtensionUiVisible: () => false,
      onDynamicCommandsChange: vi.fn(),
      onOpenFileReference: vi.fn(),
      onStreamingPhaseChange: vi.fn(),
      recentSessionsPanel,
      resetExtensionUi: vi.fn(),
      setScrollToBottomVisible: vi.fn(),
      viewport: createConversationViewportHarness(document.createElement("section")),
    });

    flow.startFreshConversation();

    expect(recentSessionsPanel.setVisible).toHaveBeenLastCalledWith(true);
  });
});

function createConversationViewportHarness(messageFeed: HTMLElement) {
  return {
    getChildElementCount() {
      return messageFeed.childElementCount;
    },
    isNearBottom() {
      return true;
    },
    scrollToBottom() {
      messageFeed.scrollTop = messageFeed.scrollHeight;
    },
  };
}
