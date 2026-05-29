export interface ConversationPageState {
  currentSessionPath: string | undefined;
  hasResolvedConversationState: boolean;
  isStreamingPhase: boolean;
  localMessageSeq: number;
  shouldAutoScroll: boolean;
}

interface ApplyReplayResultOptions {
  hasMessages: boolean;
  replace: boolean;
}

interface ApplyViewStateOptions {
  phase: string;
  sessionPath: string | undefined;
}

export function createConversationPageState(): ConversationPageState {
  return {
    currentSessionPath: undefined,
    hasResolvedConversationState: false,
    isStreamingPhase: false,
    localMessageSeq: 0,
    shouldAutoScroll: true,
  };
}

export function applyReplayResult(
  state: ConversationPageState,
  options: ApplyReplayResultOptions,
): { shouldReset: boolean } {
  if (!options.replace) return { shouldReset: false };
  state.hasResolvedConversationState = true;
  return { shouldReset: true };
}

export function applyViewState(state: ConversationPageState, options: ApplyViewStateOptions): void {
  state.isStreamingPhase = options.phase === "streaming";
  state.currentSessionPath = options.sessionPath;
}

export function beginConversationReplay(state: ConversationPageState): void {
  state.hasResolvedConversationState = false;
}

export function nextLocalMessageKey(state: ConversationPageState, prefix = "local"): string {
  state.localMessageSeq += 1;
  return `${prefix}:local:${state.localMessageSeq}`;
}

export function readCurrentSessionPath(state: ConversationPageState): string | undefined {
  return state.currentSessionPath;
}

export function resetConversationViewState(state: ConversationPageState): void {
  state.shouldAutoScroll = true;
}

export function shouldScrollToBottom(state: ConversationPageState, force = false): boolean {
  return force || state.shouldAutoScroll;
}

export function shouldShowScrollToBottomButton(state: ConversationPageState): boolean {
  return state.isStreamingPhase && !state.shouldAutoScroll;
}

export function startFreshConversation(state: ConversationPageState): void {
  state.hasResolvedConversationState = true;
}

export function syncConversationContent(
  state: ConversationPageState,
  hasConversationContent: boolean,
): boolean {
  if (hasConversationContent) {
    state.hasResolvedConversationState = true;
  }
  return state.hasResolvedConversationState && !hasConversationContent;
}

export function syncNearBottom(state: ConversationPageState, isNearBottom: boolean): boolean {
  if (state.shouldAutoScroll === isNearBottom) return false;
  state.shouldAutoScroll = isNearBottom;
  return true;
}
