// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createConversationPageFlow } from "../../../src/view/webview/features/conversation/page-flow.ts";

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
        ensureInlineActivitySlot: vi.fn(() => document.createElement("section")),
        findInlineActivitySlot: vi.fn(() => null),
        moveInlineActivitySlotToEnd: vi.fn(() => document.createElement("section")),
        reset: vi.fn(),
        setMessageText: vi.fn(),
      },
      extensionUiPanel: document.createElement("section"),
      messageFeed,
      onDynamicCommandsChange: vi.fn(),
      onOpenFileReference,
      onStreamingPhaseChange: vi.fn(),
      recentSessionsPanel: {
        setVisible: vi.fn(),
        update: vi.fn(),
      },
      scrollToBottomButton: document.createElement("button"),
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
        ensureInlineActivitySlot: vi.fn(() => document.createElement("section")),
        findInlineActivitySlot: vi.fn(() => null),
        moveInlineActivitySlotToEnd: vi.fn(() => document.createElement("section")),
        reset: vi.fn(),
        setMessageText: vi.fn(),
      },
      extensionUiPanel: document.createElement("section"),
      messageFeed: document.createElement("section"),
      onDynamicCommandsChange: vi.fn(),
      onOpenFileReference: vi.fn(),
      onStreamingPhaseChange: vi.fn(),
      recentSessionsPanel,
      scrollToBottomButton: document.createElement("button"),
    });

    flow.startFreshConversation();

    expect(recentSessionsPanel.setVisible).toHaveBeenLastCalledWith(true);
  });
});
