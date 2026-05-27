import {
  resolveAssistantActivityGroup,
  resolveAssistantStreamKey,
  resolveThinkingActivityGroup,
  resolveThinkingEntryKey,
  type ActivityControllerState,
} from "./activity-controller-state.ts";
import {
  extractAssistantText,
  extractMessageText,
  extractThinkingText,
  readResponseId,
} from "./activity-event-utils.ts";
import {
  appendFeedMessage,
  appendFinalizedGroup,
  appendTranscriptRecord,
  createEffectPlan,
  resolvePlannedGroupKey,
  type ActivityControllerEffectPlan,
} from "./activity-controller-effect-plan.ts";
import {
  appendToolCallUpdateEffects,
  appendToolResultMessageEndEffects,
} from "./activity-controller-tool-effects.ts";
import { asRecord, readString } from "./ui-text.ts";

export type {
  ActivityControllerEffect,
  ActivityControllerEffectPlan,
} from "./activity-controller-effect-plan.ts";
export { planToolExecutionEffects } from "./activity-controller-tool-effects.ts";

export function planMessageEndEffects(
  state: ActivityControllerState,
  event: Record<string, unknown>,
): ActivityControllerEffectPlan {
  const plan = createEffectPlan();
  const message = asRecord(event.message);
  const role = readString(message?.role);
  if (role === "assistant") {
    appendFinalizedGroup(plan, resolveThinkingActivityGroup(readResponseId(event)));
    const finalText = extractMessageText(message);
    if (finalText) {
      appendFeedMessage(plan, {
        aliases: [resolveAssistantStreamKey()],
        key: resolveAssistantStreamKey(readResponseId(event)),
        mode: "replace",
        role: "assistant",
        text: finalText,
      });
    }
    appendFinalizedGroup(plan, resolveAssistantActivityGroup(readResponseId(event)));
    return plan;
  }
  if (role !== "toolResult") return plan;
  appendToolResultMessageEndEffects(plan, state, event, message);
  return plan;
}

export function planMessageUpdateEffects(
  state: ActivityControllerState,
  event: Record<string, unknown>,
): ActivityControllerEffectPlan {
  const plan = createEffectPlan();
  const assistantEvent = asRecord(event.assistantMessageEvent);
  const assistantEventType = readString(assistantEvent?.type);
  if (assistantEventType?.startsWith("toolcall_")) {
    appendFinalizedGroup(plan, resolveThinkingActivityGroup(readResponseId(event)));
    appendToolCallUpdateEffects(plan, state, event);
    return plan;
  }
  if (assistantEventType?.startsWith("thinking_")) {
    appendThinkingUpdate(plan, event, assistantEventType);
    return plan;
  }

  const assistantText = extractAssistantText(event);
  if (!assistantText) return plan;
  appendFinalizedGroup(plan, resolveThinkingActivityGroup(readResponseId(event)));
  appendFeedMessage(plan, {
    aliases: [resolveAssistantStreamKey()],
    key: resolveAssistantStreamKey(readResponseId(event)),
    mode: "merge",
    role: "assistant",
    text: assistantText,
  });
  return plan;
}

function appendThinkingUpdate(
  plan: ActivityControllerEffectPlan,
  event: Record<string, unknown>,
  assistantEventType: string,
): void {
  const thinkingText = extractThinkingText(event);
  if (!thinkingText) return;
  appendTranscriptRecord(plan, {
    groupKey: resolvePlannedGroupKey(plan, resolveThinkingActivityGroup(readResponseId(event))),
    entryKey: resolveThinkingEntryKey(readResponseId(event)),
    status: assistantEventType === "thinking_end" ? "done" : "running",
    label: `思考：${thinkingText}`,
    family: "thinking",
  });
}
