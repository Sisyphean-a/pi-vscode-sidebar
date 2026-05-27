import {
  resolveToolActivityGroup,
  resolveToolEntryKey,
  resolveToolResultEntryKey,
  type ActivityControllerState,
} from "./activity-controller-state.ts";
import {
  resolveToolFamily,
  summarizeToolDetailSummary,
  summarizeToolLabel,
  summarizeToolResultDetailSummary,
} from "./activity-event-utils.ts";
import {
  resolvePlannedGroupKey,
  type ActivityControllerEffectPlan,
} from "./activity-controller-effect-plan.ts";
import type { ActivityEntryStatus, ActivityEntryUpdate } from "./activity-transcript.ts";

export interface PlannedToolEffectContext {
  responseId?: string;
  toolArgs?: string;
  toolCallId?: string;
  toolName: string;
  toolText?: string;
}

export interface ToolEffectContext extends PlannedToolEffectContext {
  groupKey: string;
}

export function resolvePlannedToolGroupKey(
  plan: ActivityControllerEffectPlan,
  state: ActivityControllerState,
  context: PlannedToolEffectContext,
): string {
  return resolvePlannedGroupKey(
    plan,
    resolveToolActivityGroup(state, {
      responseId: context.responseId,
      toolCallId: context.toolCallId,
    }),
  );
}

export function resolveToolRunningEntryKey(
  context: Pick<PlannedToolEffectContext, "responseId" | "toolCallId" | "toolName">,
): string {
  return resolveToolEntryKey({
    responseId: context.responseId,
    toolCallId: context.toolCallId,
    toolName: context.toolName,
  });
}

export function resolveToolResultEntryKeyFromContext(
  context: Pick<PlannedToolEffectContext, "toolCallId" | "toolName">,
): string {
  return resolveToolResultEntryKey({
    toolCallId: context.toolCallId,
    toolName: context.toolName,
  });
}

export function buildToolCallTranscriptUpdate(context: ToolEffectContext): ActivityEntryUpdate {
  return {
    groupKey: context.groupKey,
    entryKey: resolveToolRunningEntryKey(context),
    status: "running",
    label: summarizeToolLabel(context.toolName, context.toolArgs),
    detail: context.toolArgs,
    detailSummary: summarizeToolDetailSummary(context.toolName, context.toolArgs),
    family: resolveToolFamily(context.toolName),
  };
}

export function buildToolResultTranscriptUpdate(context: ToolEffectContext): ActivityEntryUpdate {
  return buildToolTranscriptUpdate(context, "done", context.toolText || undefined);
}

export function buildToolExecutionTranscriptUpdate(
  context: ToolEffectContext,
  status: ActivityEntryStatus,
): ActivityEntryUpdate {
  const detailSummary = context.toolText
    ? summarizeToolResultDetailSummary(context.toolName, context.toolText)
    : summarizeToolDetailSummary(context.toolName, context.toolArgs);
  return buildToolTranscriptUpdate(context, status, context.toolText, detailSummary);
}

function buildToolTranscriptUpdate(
  context: ToolEffectContext,
  status: ActivityEntryStatus,
  detail: string | undefined,
  detailSummary = summarizeToolResultDetailSummary(context.toolName, context.toolText ?? ""),
): ActivityEntryUpdate {
  return {
    groupKey: context.groupKey,
    entryKey:
      status === "done"
        ? resolveToolResultEntryKeyFromContext(context)
        : resolveToolRunningEntryKey(context),
    status,
    label: summarizeToolLabel(context.toolName, context.toolArgs, context.toolText),
    detail,
    detailSummary,
    family: resolveToolFamily(context.toolName),
  };
}
