import {
  createProcessingStatus,
  formatProcessingStatus,
  isAssistantMessageStartEvent,
  planMessageEndEffects,
  planMessageUpdateEffects,
  planToolExecutionEffects,
  type ActivityControllerEffect,
  type ActivityControllerEffectPlan,
} from "./controller-effects.ts";
import { planHistoryMessageEffects } from "./controller-history-effects.ts";
import {
  createActivityControllerState,
  nextInlineNoteKey,
  rememberToolActivity,
  resetActivityControllerState,
} from "./controller-state.ts";
import { createActivityTranscript, type ActivityTranscript } from "./transcript.ts";
import type { ConversationFeed } from "../conversation/feed.ts";

interface CreateActivityControllerOptions {
  container: HTMLElement;
  conversationFeed: ConversationFeed;
  onChange(): void;
  resolveContainer?(): HTMLElement | null | undefined;
}

export interface ActivityController {
  applyAgentEnd(event: Record<string, unknown>): void;
  appendInlineNote(message: string): void;
  applyMessageEnd(event: Record<string, unknown>): void;
  applyMessageStart(event: Record<string, unknown>): void;
  applyMessageUpdate(event: Record<string, unknown>): void;
  applyToolExecutionEvent(event: Record<string, unknown>, eventType: string): void;
  hydrateHistoryMessage(message: Record<string, unknown>, index: number): void;
  reset(): void;
}

export function createActivityController(
  options: CreateActivityControllerOptions,
): ActivityController {
  const activityTranscript = createActivityTranscript({
    container: resolveActivityContainer(options),
    onChange: options.onChange,
    resolveContainer: options.resolveContainer,
  });
  const state = createActivityControllerState();
  const applyPlan = createActivityPlanApplier(state, activityTranscript, options.conversationFeed);
  let processingStatus: ReturnType<typeof createProcessingStatus> | undefined;

  const stopProcessingStatus = () => {
    processingStatus?.stop();
    activityTranscript.appendNote(state.processingStatusKey, "");
    processingStatus = undefined;
  };

  return {
    applyAgentEnd() {
      stopProcessingStatus();
    },
    appendInlineNote(message) {
      activityTranscript.appendNote(nextInlineNoteKey(state), message);
    },
    applyMessageEnd(event) {
      applyPlan(planMessageEndEffects(state, event));
    },
    applyMessageStart(event) {
      if (!isAssistantMessageStartEvent(event) || processingStatus) return;
      options.conversationFeed.moveInlineActivitySlotToEnd();
      resolveActivityContainer(options);
      processingStatus = createProcessingStatus({
        now: () => Date.now(),
        onTick(message) {
          activityTranscript.appendNote(state.processingStatusKey, message);
          options.onChange();
        },
      });
      activityTranscript.appendNote(
        state.processingStatusKey,
        formatProcessingStatus(processingStatus.startedAt, Date.now()),
      );
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
      stopProcessingStatus();
      resetActivityControllerState(state);
      activityTranscript.reset();
    },
  };
}

function resolveActivityContainer(options: CreateActivityControllerOptions): HTMLElement {
  const resolved = options.resolveContainer?.();
  if (resolved) return resolved;
  return options.container;
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
