import { z } from "zod";
import type { RecentSessionSummary } from "../../../../shared/recent-sessions.ts";
import type { ActivityController } from "../activity/controller.ts";
import {
  applyReplayResult,
  applyViewState,
  readCurrentSessionPath,
  type ConversationPageState,
} from "./page-state.ts";
import type { RecentSessionsPanel } from "../recent-sessions/panel.ts";
import { readRecord } from "../activity/event-zod.ts";

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

const RecentSessionSummarySchema: z.ZodType<RecentSessionSummary> = z.object({
  sessionId: z.string(),
  sessionPath: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});

const ConversationPageStatePayloadSchema = z
  .object({
    view: z
      .object({
        phase: z.string().optional(),
      })
      .optional(),
    rpc: z
      .object({
        sessionFile: z.string().optional(),
      })
      .optional(),
    recentSessions: z.array(RecentSessionSummarySchema).optional(),
  })
  .catchall(z.unknown());

export function applyConversationPageStateMessage(
  options: ApplyConversationPageStateMessageOptions,
): void {
  const parsed = ConversationPageStatePayloadSchema.safeParse(options.data);
  if (!parsed.success) return;
  applyViewState(options.state, {
    phase: parsed.data.view?.phase ?? "idle",
    sessionPath: parsed.data.rpc?.sessionFile,
  });
  options.onStreamingPhaseChange(options.state.isStreamingPhase);
  options.updateScrollToBottomButton();
  if (!parsed.data.recentSessions) return;
  options.recentSessionsPanel.update(
    parsed.data.recentSessions,
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
    const message = readRecord(options.messages[index]);
    if (!message) continue;
    options.activityController.hydrateHistoryMessage(message, index);
  }
  options.syncRecentSessionsVisibility();
}
