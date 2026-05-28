import type { CommandUiRequest } from "../../../protocol.ts";

export interface CommandUiState {
  currentRequest?: CommandUiRequest;
  selectedIndex: number;
}

export function createCommandUiState(): CommandUiState {
  return {
    currentRequest: undefined,
    selectedIndex: 0,
  };
}

export function clearCommandUiState(state: CommandUiState): void {
  state.currentRequest = undefined;
  state.selectedIndex = 0;
}

export function setCommandUiRequest(state: CommandUiState, request: CommandUiRequest): void {
  state.currentRequest = request;
  state.selectedIndex = request.items.findIndex((item) => item.active);
  if (state.selectedIndex < 0) state.selectedIndex = 0;
}

export function moveCommandUiSelection(state: CommandUiState, delta: number): boolean {
  const request = state.currentRequest;
  if (!request || request.items.length === 0) return false;
  state.selectedIndex = (state.selectedIndex + delta + request.items.length) % request.items.length;
  return true;
}

export function readCommandUiSelectionPayload(
  state: CommandUiState,
  index = state.selectedIndex,
): { requestId: string; payload: unknown } | undefined {
  const request = state.currentRequest;
  if (!request) return undefined;
  const item = request.items[index];
  if (!item) return undefined;
  return {
    requestId: request.id,
    payload: item.payload ?? { selectedId: item.id },
  };
}
