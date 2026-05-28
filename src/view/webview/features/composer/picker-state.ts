export interface ComposerPickerOption {
  value: string;
  label: string;
}

export interface ComposerPickerState {
  currentOptions: ComposerPickerOption[];
  currentValue: string;
  fallbackLabel: string;
  isOpen: boolean;
}

export function createComposerPickerState(): ComposerPickerState {
  return {
    currentOptions: [],
    currentValue: "",
    fallbackLabel: "",
    isOpen: false,
  };
}

export function hasComposerPickerOption(state: ComposerPickerState, value: string): boolean {
  return state.currentOptions.some((option) => option.value === value);
}

export function openComposerPicker(state: ComposerPickerState): boolean {
  if (state.isOpen) return false;
  state.isOpen = true;
  return true;
}

export function closeComposerPicker(state: ComposerPickerState): boolean {
  if (!state.isOpen) return false;
  state.isOpen = false;
  return true;
}

export function setComposerPickerFallbackLabel(state: ComposerPickerState, label: string): void {
  state.fallbackLabel = label;
}

export function setComposerPickerOptions(
  state: ComposerPickerState,
  options: ComposerPickerOption[],
): void {
  state.currentOptions = options.map(copyComposerPickerOption);
  if (state.currentOptions.length === 0) {
    state.isOpen = false;
  }
}

export function setComposerPickerValue(state: ComposerPickerState, value: string): void {
  state.currentValue = value;
}

export function selectComposerPickerOption(state: ComposerPickerState, value: string): boolean {
  if (!value || value === state.currentValue || !hasComposerPickerOption(state, value)) {
    return false;
  }
  state.currentValue = value;
  return true;
}

function copyComposerPickerOption(option: ComposerPickerOption): ComposerPickerOption {
  return {
    value: option.value,
    label: option.label,
  };
}
