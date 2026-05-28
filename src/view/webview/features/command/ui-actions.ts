import type { CommandUiState } from "./ui-state.ts";
import { moveCommandUiSelection, readCommandUiSelectionPayload } from "./ui-state.ts";

export type CommandUiKeyAction =
  | { type: "cancel"; requestId: string }
  | { type: "handled" }
  | { type: "ignore" }
  | { type: "rerender" }
  | { type: "submit"; payload: unknown; requestId: string };

export function resolveCommandUiKeyAction(
  state: CommandUiState,
  key: string,
  shiftKey: boolean,
): CommandUiKeyAction {
  const request = state.currentRequest;
  if (!request) return { type: "ignore" };
  if (key === "ArrowDown") return moveSelection(state, 1);
  if (key === "ArrowUp") return moveSelection(state, -1);
  if (key === "Escape") return { type: "cancel", requestId: request.id };
  if (key !== "Enter" || shiftKey) return { type: "ignore" };
  const selection = readCommandUiSelectionPayload(state);
  return selection ? { type: "submit", ...selection } : { type: "handled" };
}

function moveSelection(state: CommandUiState, delta: number): CommandUiKeyAction {
  return moveCommandUiSelection(state, delta) ? { type: "rerender" } : { type: "handled" };
}
