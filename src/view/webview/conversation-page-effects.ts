import type { RecentSessionSummary } from "../../shared/recent-sessions.ts";
import type { ActivityController } from "./activity-controller.ts";
import {
  applyReplayResult,
  applyViewState,
  readCurrentSessionPath,
  type ConversationPageState,
} from "./conversation-page-state.ts";
import type { RecentSessionsPanel } from "./recent-sessions.ts";
import { asRecord, readString } from "./ui-text.ts";

interface ApplyConversationPageStateMessageOptions {
  data: Record<string, unknown>;
  onStreamingPhaseChange(isStreaming: boolean): void;
  recentSessionsPanel: Pick<RecentSessionsPanel, "update">;
  state: ConversationPageState;
  syncRecentSessionsVisibility(): void;
  updateScrollToBottomButton(): void;
}

interface ApplyConversationReplayQueryResultOptions {
  activityController: Pick<ActivityController, "hydrateHistoryMessage">;
  messages: unknown[] | undefined;
  replace: boolean;
  resetConversationView(): void;
  state: ConversationPageState;
  syncRecentSessionsVisibility(): void;
}

export function applyConversationPageStateMessage(
  options: ApplyConversationPageStateMessageOptions,
): void {
  const view = asRecord(options.data.view);
  const rpc = asRecord(options.data.rpc);
  applyViewState(options.state, {
    phase: readString(view?.phase) ?? "idle",
    sessionPath: readString(rpc?.sessionFile),
  });
  options.onStreamingPhaseChange(options.state.isStreamingPhase);
  options.updateScrollToBottomButton();
  if (!Array.isArray(options.data.recentSessions)) return;
  options.recentSessionsPanel.update(
    options.data.recentSessions as RecentSessionSummary[],
    readCurrentSessionPath(options.state),
  );
  options.syncRecentSessionsVisibility();
}

export function applyConversationReplayQueryResult(
  options: ApplyConversationReplayQueryResultOptions,
): void {
  const replayOutcome = applyReplayResult(options.state, {
    hasMessages: !!options.messages && options.messages.length > 0,
    replace: options.replace,
  });

  if (!options.messages || options.messages.length === 0) {
    if (replayOutcome.shouldReset) {
      options.resetConversationView();
      options.syncRecentSessionsVisibility();
    }
    return;
  }

  if (replayOutcome.shouldReset) {
    options.resetConversationView();
  }
  for (let index = 0; index < options.messages.length; index += 1) {
    const message = asRecord(options.messages[index]);
    if (!message) continue;
    options.activityController.hydrateHistoryMessage(message, index);
  }
  options.syncRecentSessionsVisibility();
}
