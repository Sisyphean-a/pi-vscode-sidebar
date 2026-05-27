import {
  resolveComposerPickerDismissAction,
  resolveComposerPickerOpenedElsewhereAction,
  resolveComposerPickerSelectionAction,
  resolveComposerPickerTriggerAction,
} from "./composer-picker-actions.ts";
import {
  createComposerPickerState,
  hasComposerPickerOption,
  setComposerPickerFallbackLabel,
  setComposerPickerOptions,
  setComposerPickerValue,
  type ComposerPickerOption,
  type ComposerPickerState,
} from "./composer-picker-state.ts";
import { syncComposerPickerUi, type ComposerPickerDomRefs } from "./composer-picker-dom.ts";

export interface ComposerPicker {
  hasOption(value: string): boolean;
  setDisabled(disabled: boolean): void;
  setFallbackLabel(label: string): void;
  setOptions(options: ComposerPickerOption[]): void;
  setValue(value: string): void;
}

interface CreateComposerPickerOptions {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  list: HTMLElement;
  onChange(value: string): void;
}

export function createComposerPicker(options: CreateComposerPickerOptions): ComposerPicker {
  const refs = createComposerPickerRefs(options);
  const state = createComposerPickerState();

  bindTriggerToggle(refs, state);
  bindOptionSelection(options, refs, state);
  bindDismissListeners(refs, state);
  renderComposerPicker(refs, state);

  return {
    hasOption(value) {
      return hasComposerPickerOption(state, value);
    },
    setDisabled(disabled) {
      refs.trigger.disabled = disabled;
      refs.root.classList.toggle("is-disabled", disabled);
      if (disabled) resolveComposerPickerDismissAction(state);
      renderComposerPicker(refs, state);
    },
    setFallbackLabel(label) {
      setComposerPickerFallbackLabel(state, label);
      renderComposerPicker(refs, state);
    },
    setOptions(nextOptions) {
      setComposerPickerOptions(state, nextOptions);
      renderComposerPicker(refs, state);
    },
    setValue(value) {
      setComposerPickerValue(state, value);
      renderComposerPicker(refs, state);
    },
  };
}

function createComposerPickerRefs(options: CreateComposerPickerOptions): ComposerPickerDomRefs {
  return {
    root: options.root,
    trigger: options.trigger,
    panel: options.panel,
    list: options.list,
  };
}

function bindTriggerToggle(refs: ComposerPickerDomRefs, state: ComposerPickerState): void {
  refs.trigger.addEventListener("click", () => {
    const action = resolveComposerPickerTriggerAction(state, refs.trigger.disabled);
    if (action === "ignore") return;
    if (action === "open") {
      document.dispatchEvent(new CustomEvent("composer-picker:open", { detail: refs.root.id }));
    }
    renderComposerPicker(refs, state);
  });
}

function bindOptionSelection(
  options: CreateComposerPickerOptions,
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
): void {
  refs.list.addEventListener("click", (event) => {
    const button = readComposerPickerButton(event.target);
    if (!button || button.disabled) return;
    const action = resolveComposerPickerSelectionAction(state, button.dataset.value ?? "");
    if (action.type === "ignore") return;
    renderComposerPicker(refs, state);
    if (action.type === "change") {
      options.onChange(action.value);
    }
  });
}

function bindDismissListeners(refs: ComposerPickerDomRefs, state: ComposerPickerState): void {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || refs.root.contains(event.target)) return;
    if (!resolveComposerPickerDismissAction(state)) return;
    renderComposerPicker(refs, state);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !resolveComposerPickerDismissAction(state)) return;
    renderComposerPicker(refs, state);
  });

  document.addEventListener("composer-picker:open", (event) => {
    const customEvent = event as CustomEvent<string>;
    if (!resolveComposerPickerOpenedElsewhereAction(state, customEvent.detail, refs.root.id)) {
      return;
    }
    renderComposerPicker(refs, state);
  });
}

function renderComposerPicker(refs: ComposerPickerDomRefs, state: ComposerPickerState): void {
  syncComposerPickerUi(refs, state);
}

function readComposerPickerButton(target: EventTarget | null): HTMLButtonElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest<HTMLButtonElement>(".composer-picker-option") ?? undefined;
}
