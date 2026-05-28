const ACTIVE_ASSISTANT_MESSAGE_KEY = "assistant:active";
const ACTIVE_ASSISTANT_ACTIVITY_KEY = "assistant-activity:live";
const ACTIVE_THINKING_ACTIVITY_KEY = "assistant-thinking:live";

export interface ActivityControllerState {
  activityGroupByToolCallId: Map<string, string>;
  localActivitySeq: number;
  processingStatusKey: string;
  toolArgsByToolCallId: Map<string, string>;
}

export interface ActivityGroupResolution {
  groupKey: string;
  renameFrom?: string;
}

interface RememberToolActivityOptions {
  groupKey: string;
  toolArgs?: string;
  toolCallId?: string;
}

interface ResolveToolActivityGroupOptions {
  responseId?: string;
  toolCallId?: string;
}

interface ResolveToolEntryKeyOptions {
  responseId?: string;
  toolCallId?: string;
  toolName: string;
}

interface ResolveToolResultEntryKeyOptions {
  toolCallId?: string;
  toolName: string;
}

export function createActivityControllerState(): ActivityControllerState {
  return {
    activityGroupByToolCallId: new Map<string, string>(),
    localActivitySeq: 0,
    processingStatusKey: "note:processing",
    toolArgsByToolCallId: new Map<string, string>(),
  };
}

export function nextInlineNoteKey(state: ActivityControllerState): string {
  state.localActivitySeq += 1;
  return `note:${state.localActivitySeq}`;
}

export function readStoredToolArgs(
  state: ActivityControllerState,
  toolCallId: string | undefined,
): string | undefined {
  if (!toolCallId) return undefined;
  return state.toolArgsByToolCallId.get(toolCallId);
}

export function rememberToolActivity(
  state: ActivityControllerState,
  options: RememberToolActivityOptions,
): void {
  if (!options.toolCallId) return;
  state.activityGroupByToolCallId.set(options.toolCallId, options.groupKey);
  if (options.toolArgs) {
    state.toolArgsByToolCallId.set(options.toolCallId, options.toolArgs);
  }
}

export function resetActivityControllerState(state: ActivityControllerState): void {
  state.activityGroupByToolCallId.clear();
  state.localActivitySeq = 0;
  state.toolArgsByToolCallId.clear();
}

export function resolveAssistantActivityGroup(responseId?: string): ActivityGroupResolution {
  if (!responseId) {
    return { groupKey: ACTIVE_ASSISTANT_ACTIVITY_KEY };
  }
  return {
    groupKey: `assistant-activity:${responseId}`,
    renameFrom: ACTIVE_ASSISTANT_ACTIVITY_KEY,
  };
}

export function resolveAssistantStreamKey(responseId?: string): string {
  return responseId ? `assistant:${responseId}` : ACTIVE_ASSISTANT_MESSAGE_KEY;
}

export function resolveThinkingActivityGroup(responseId?: string): ActivityGroupResolution {
  if (!responseId) {
    return { groupKey: ACTIVE_THINKING_ACTIVITY_KEY };
  }
  return {
    groupKey: `assistant-thinking:${responseId}`,
    renameFrom: ACTIVE_THINKING_ACTIVITY_KEY,
  };
}

export function resolveThinkingEntryKey(responseId?: string): string {
  return responseId ? `${responseId}:thinking` : "live:thinking";
}

export function resolveToolActivityGroup(
  state: ActivityControllerState,
  options: ResolveToolActivityGroupOptions,
): ActivityGroupResolution {
  if (options.toolCallId) {
    const mappedKey = state.activityGroupByToolCallId.get(options.toolCallId);
    if (mappedKey) {
      return { groupKey: mappedKey };
    }
  }
  return resolveAssistantActivityGroup(options.responseId);
}

export function resolveToolEntryKey(options: ResolveToolEntryKeyOptions): string {
  if (options.toolCallId) return options.toolCallId;
  if (options.responseId) return `${options.responseId}:${options.toolName}`;
  return `live:${options.toolName}`;
}

export function resolveToolResultEntryKey(options: ResolveToolResultEntryKeyOptions): string {
  if (options.toolCallId) return options.toolCallId;
  return `done:${options.toolName}`;
}
