import { readStoredToolArgs, type ActivityControllerState } from "./controller-state.ts";
import {
  extractMessageText,
  extractToolExecutionText,
  readResponseId,
  readToolArgsFromEvent,
  readToolArgsFromExecutionEvent,
  readToolCallIdFromEvent,
  readToolNameFromEvent,
} from "./event-utils.ts";
import {
  appendRememberToolActivity,
  appendRenameEntry,
  appendTranscriptRecord,
  createEffectPlan,
  type ActivityControllerEffectPlan,
} from "./controller-effect-plan.ts";
import {
  buildToolCallTranscriptUpdate,
  buildToolExecutionTranscriptUpdate,
  buildToolResultTranscriptUpdate,
  resolvePlannedToolGroupKey,
  resolveToolResultEntryKeyFromContext,
  resolveToolRunningEntryKey,
} from "./controller-tool-effect-support.ts";
import { readString } from "./event-zod.ts";

export function appendToolCallUpdateEffects(
  plan: ActivityControllerEffectPlan,
  state: ActivityControllerState,
  event: Record<string, unknown>,
): void {
  const context = {
    responseId: readResponseId(event),
    toolName: readToolNameFromEvent(event) ?? "tool",
    toolCallId: readToolCallIdFromEvent(event),
    toolArgs: readToolArgsFromEvent(event),
  };
  const groupKey = resolvePlannedToolGroupKey(plan, state, context);
  appendRememberToolActivity(plan, {
    groupKey,
    toolArgs: context.toolArgs,
    toolCallId: context.toolCallId,
  });
  appendTranscriptRecord(plan, buildToolCallTranscriptUpdate({ ...context, groupKey }));
}

export function appendToolResultMessageEndEffects(
  plan: ActivityControllerEffectPlan,
  state: ActivityControllerState,
  event: Record<string, unknown>,
  message: Record<string, unknown> | undefined,
): void {
  const context = {
    responseId: readResponseId(event),
    toolName: readString(message?.toolName) ?? readToolNameFromEvent(event) ?? "tool",
    toolCallId: readString(message?.toolCallId),
    toolArgs:
      readToolArgsFromEvent(event) ?? readStoredToolArgs(state, readString(message?.toolCallId)),
    toolText: extractMessageText(message),
  };
  const groupKey = resolvePlannedToolGroupKey(plan, state, {
    ...context,
    toolCallId: readToolCallIdFromEvent(event),
  });
  appendRenameEntry(
    plan,
    groupKey,
    resolveToolRunningEntryKey({
      responseId: context.responseId,
      toolCallId: readToolCallIdFromEvent(event),
      toolName: context.toolName,
    }),
    resolveToolResultEntryKeyFromContext(context),
  );
  appendTranscriptRecord(plan, buildToolResultTranscriptUpdate({ ...context, groupKey }));
}

export function planToolExecutionEffects(
  state: ActivityControllerState,
  event: Record<string, unknown>,
  eventType: string,
): ActivityControllerEffectPlan {
  const plan = createEffectPlan();
  const context = {
    responseId: readResponseId(event),
    toolName: readString(event.toolName) ?? "tool",
    toolCallId: readToolCallIdFromEvent(event),
    toolArgs: readToolArgsFromExecutionEvent(event),
    toolText: extractToolExecutionText(event),
  };
  const groupKey = resolvePlannedToolGroupKey(plan, state, context);
  appendRememberToolActivity(plan, {
    groupKey,
    toolArgs: context.toolArgs,
    toolCallId: context.toolCallId,
  });
  appendTranscriptRecord(
    plan,
    buildToolExecutionTranscriptUpdate(
      { ...context, groupKey },
      eventType === "tool_execution_end" ? "done" : "running",
    ),
  );
  return plan;
}
