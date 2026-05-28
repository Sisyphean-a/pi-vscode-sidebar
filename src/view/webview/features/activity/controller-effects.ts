import {
  resolveAssistantActivityGroup,
  resolveAssistantStreamKey,
  resolveThinkingActivityGroup,
  resolveThinkingEntryKey,
  type ActivityControllerState,
} from "./controller-state.ts";
import {
  extractAssistantText,
  extractMessageText,
  extractThinkingText,
  readResponseId,
} from "./event-readers.ts";
import {
  appendFeedMessage,
  appendFinalizedGroup,
  appendTranscriptRecord,
  createEffectPlan,
  resolvePlannedGroupKey,
  type ActivityControllerEffectPlan,
} from "./controller-effect-plan.ts";
import {
  appendToolCallUpdateEffects,
  appendToolResultMessageEndEffects,
} from "./controller-tool-effects.ts";
import { readRecord, readString } from "./event-zod.ts";

const PROCESSING_STATUS_TICK_MS = 1000;

interface CreateProcessingStatusOptions {
  now(): number;
  onTick(message: string): void;
}

interface ProcessingStatusHandle {
  startedAt: number;
  stop(): void;
}

export type {
  ActivityControllerEffect,
  ActivityControllerEffectPlan,
} from "./controller-effect-plan.ts";
export { planToolExecutionEffects } from "./controller-tool-effects.ts";

export function isAssistantMessageStartEvent(event: Record<string, unknown>): boolean {
  const message = readRecord(event.message);
  return readString(message?.role) === "assistant";
}

export function formatProcessingStatus(startedAt: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  if (hours > 0) return `已处理 ${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `已处理 ${minutes}m ${seconds}s`;
  return `已处理 ${seconds}s`;
}

export function createProcessingStatus(
  options: CreateProcessingStatusOptions,
): ProcessingStatusHandle {
  const startedAt = options.now();
  const timer = setInterval(() => {
    options.onTick(formatProcessingStatus(startedAt, options.now()));
  }, PROCESSING_STATUS_TICK_MS);
  return {
    startedAt,
    stop() {
      clearInterval(timer);
    },
  };
}

export function planMessageEndEffects(
  state: ActivityControllerState,
  event: Record<string, unknown>,
): ActivityControllerEffectPlan {
  const plan = createEffectPlan();
  const message = readRecord(event.message);
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
  const assistantEvent = readRecord(event.assistantMessageEvent);
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
