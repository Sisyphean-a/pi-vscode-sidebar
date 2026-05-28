import {
  closeComposerPicker,
  openComposerPicker,
  selectComposerPickerOption,
  type ComposerPickerState,
} from "./picker-state.ts";

export type ComposerPickerSelectionAction =
  | { type: "change"; value: string }
  | { type: "close" }
  | { type: "ignore" };

export function resolveComposerPickerTriggerAction(
  state: ComposerPickerState,
  disabled: boolean,
): "close" | "ignore" | "open" {
  if (disabled || state.currentOptions.length === 0) return "ignore";
  if (state.isOpen) {
    return closeComposerPicker(state) ? "close" : "ignore";
  }
  openComposerPicker(state);
  return "open";
}

export function resolveComposerPickerSelectionAction(
  state: ComposerPickerState,
  value: string,
): ComposerPickerSelectionAction {
  const closed = closeComposerPicker(state);
  if (selectComposerPickerOption(state, value)) {
    return { type: "change", value };
  }
  return closed ? { type: "close" } : { type: "ignore" };
}

export function resolveComposerPickerDismissAction(state: ComposerPickerState): boolean {
  return closeComposerPicker(state);
}

export function resolveComposerPickerOpenedElsewhereAction(
  state: ComposerPickerState,
  openedPickerId: string,
  ownPickerId: string,
): boolean {
  if (openedPickerId === ownPickerId) return false;
  return closeComposerPicker(state);
}
