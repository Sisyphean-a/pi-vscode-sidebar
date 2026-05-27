export type PendingCommandUiKind = "fork" | "model" | "resume" | "tree";

export interface PendingCommandUiRequest {
  kind: PendingCommandUiKind;
  rawInput: string;
}

export interface CommandUiFlowState {
  pendingRequests: Map<string, PendingCommandUiRequest>;
}

export function createCommandUiFlowState(): CommandUiFlowState {
  return {
    pendingRequests: new Map<string, PendingCommandUiRequest>(),
  };
}

export function rememberPendingCommandUiRequest(
  state: CommandUiFlowState,
  requestId: string,
  pending: PendingCommandUiRequest,
): void {
  state.pendingRequests.set(requestId, pending);
}

export function takePendingCommandUiRequest(
  state: CommandUiFlowState,
  requestId: string,
): PendingCommandUiRequest | undefined {
  const pending = state.pendingRequests.get(requestId);
  if (!pending) return undefined;
  state.pendingRequests.delete(requestId);
  return pending;
}
