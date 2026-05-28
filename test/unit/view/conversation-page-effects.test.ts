import { describe, expect, it, vi } from "vitest";

import { createConversationPageState } from "../../../src/view/webview/conversation-page-state.ts";
import {
  applyConversationPageStateMessage,
  applyConversationReplayQueryResult,
} from "../../../src/view/webview/conversation-page-effects.ts";

describe("conversation page effects", () => {
  it("applies state updates and refreshes recent sessions with the current session path", () => {
    const state = createConversationPageState();
    const onStreamingPhaseChange = vi.fn();
    const recentSessionsPanel = {
      update: vi.fn(),
    };
    const syncRecentSessionsVisibility = vi.fn();
    const updateScrollToBottomButton = vi.fn();
    const recentSessions = [
      {
        sessionId: "session-1",
        sessionPath: "C:\\sessions\\session-1.jsonl",
        title: "title",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
    ];

    applyConversationPageStateMessage({
      data: {
        view: { phase: "streaming" },
        rpc: { sessionFile: "C:\\sessions\\session-1.jsonl" },
        recentSessions,
      },
      onStreamingPhaseChange,
      recentSessionsPanel,
      state,
      syncRecentSessionsVisibility,
      updateScrollToBottomButton,
    });

    expect(onStreamingPhaseChange).toHaveBeenCalledWith(true);
    expect(recentSessionsPanel.update).toHaveBeenCalledWith(
      recentSessions,
      "C:\\sessions\\session-1.jsonl",
    );
    expect(syncRecentSessionsVisibility).toHaveBeenCalledTimes(1);
    expect(updateScrollToBottomButton).toHaveBeenCalledTimes(1);
  });

  it("resets the conversation view when replace replay resolves with no messages", () => {
    const resetConversationView = vi.fn();
    const syncRecentSessionsVisibility = vi.fn();
    const hydrateHistoryMessage = vi.fn();

    applyConversationReplayQueryResult({
      activityController: { hydrateHistoryMessage },
      messages: [],
      replace: true,
      resetConversationView,
      state: createConversationPageState(),
      syncRecentSessionsVisibility,
    });

    expect(resetConversationView).toHaveBeenCalledTimes(1);
    expect(syncRecentSessionsVisibility).toHaveBeenCalledTimes(1);
    expect(hydrateHistoryMessage).not.toHaveBeenCalled();
  });

  it("hydrates replayed history messages after resetting replace results", () => {
    const resetConversationView = vi.fn();
    const syncRecentSessionsVisibility = vi.fn();
    const hydrateHistoryMessage = vi.fn();

    applyConversationReplayQueryResult({
      activityController: { hydrateHistoryMessage },
      messages: [{ role: "assistant", id: "msg-1" }, null],
      replace: true,
      resetConversationView,
      state: createConversationPageState(),
      syncRecentSessionsVisibility,
    });

    expect(resetConversationView).toHaveBeenCalledTimes(1);
    expect(hydrateHistoryMessage).toHaveBeenCalledWith({ role: "assistant", id: "msg-1" }, 0);
    expect(syncRecentSessionsVisibility).toHaveBeenCalledTimes(1);
  });

  it("ignores invalid recent session payloads at boundary", () => {
    const state = createConversationPageState();
    const recentSessionsPanel = { update: vi.fn() };

    applyConversationPageStateMessage({
      data: {
        view: { phase: "streaming" },
        rpc: { sessionFile: "C:\\sessions\\session-1.jsonl" },
        recentSessions: [{ sessionPath: "missing-required-fields" }],
      },
      onStreamingPhaseChange: vi.fn(),
      recentSessionsPanel,
      state,
      syncRecentSessionsVisibility: vi.fn(),
      updateScrollToBottomButton: vi.fn(),
    });

    expect(recentSessionsPanel.update).not.toHaveBeenCalled();
  });
});
