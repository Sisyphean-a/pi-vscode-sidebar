import {
  planMessageEndEffects,
  planMessageUpdateEffects,
  planToolExecutionEffects,
  type ActivityControllerEffect,
  type ActivityControllerEffectPlan,
} from "./activity-controller-effects.ts";
import { planHistoryMessageEffects } from "./activity-controller-history-effects.ts";
import {
  createActivityControllerState,
  nextInlineNoteKey,
  rememberToolActivity,
  resetActivityControllerState,
} from "./activity-controller-state.ts";
import { createActivityTranscript, type ActivityTranscript } from "./activity-transcript.ts";
import type { ConversationFeed } from "./conversation-feed.ts";

interface CreateActivityControllerOptions {
  container: HTMLElement;
  conversationFeed: ConversationFeed;
  onChange(): void;
}

export interface ActivityController {
  appendInlineNote(message: string): void;
  applyMessageEnd(event: Record<string, unknown>): void;
  applyMessageUpdate(event: Record<string, unknown>): void;
  applyToolExecutionEvent(event: Record<string, unknown>, eventType: string): void;
  hydrateHistoryMessage(message: Record<string, unknown>, index: number): void;
  reset(): void;
}

export function createActivityController(
  options: CreateActivityControllerOptions,
): ActivityController {
  const activityTranscript = createActivityTranscript({
    container: options.container,
    onChange: options.onChange,
  });
  const state = createActivityControllerState();
  const applyPlan = createActivityPlanApplier(state, activityTranscript, options.conversationFeed);

  return {
    appendInlineNote(message) {
      activityTranscript.appendNote(nextInlineNoteKey(state), message);
    },
    applyMessageEnd(event) {
      applyPlan(planMessageEndEffects(state, event));
    },
    applyMessageUpdate(event) {
      applyPlan(planMessageUpdateEffects(state, event));
    },
    applyToolExecutionEvent(event, eventType) {
      applyPlan(planToolExecutionEffects(state, event, eventType));
    },
    hydrateHistoryMessage(message, index) {
      applyPlan(planHistoryMessageEffects(message, index));
    },
    reset() {
      resetActivityControllerState(state);
      activityTranscript.reset();
    },
  };
}

function createActivityPlanApplier(
  state: ReturnType<typeof createActivityControllerState>,
  activityTranscript: ActivityTranscript,
  conversationFeed: ConversationFeed,
): (plan: ActivityControllerEffectPlan) => void {
  return (plan) => {
    for (const effect of plan.effects) {
      applyActivityControllerEffect(effect, state, activityTranscript, conversationFeed);
    }
  };
}

function applyActivityControllerEffect(
  effect: ActivityControllerEffect,
  state: ReturnType<typeof createActivityControllerState>,
  activityTranscript: ActivityTranscript,
  conversationFeed: ConversationFeed,
): void {
  switch (effect.type) {
    case "feedMessage":
      conversationFeed.setMessageText(
        effect.key,
        effect.role,
        effect.text,
        effect.mode,
        effect.aliases,
      );
      return;
    case "finalizeGroup":
      activityTranscript.finalizeGroup(effect.groupKey);
      return;
    case "recordTranscript":
      activityTranscript.record(effect.update);
      return;
    case "rememberToolActivity":
      rememberToolActivity(state, effect);
      return;
    case "renameEntry":
      activityTranscript.renameEntry(effect.groupKey, effect.fromKey, effect.toKey);
      return;
    case "renameGroup":
      activityTranscript.renameGroup(effect.fromKey, effect.toKey);
      return;
  }
}
