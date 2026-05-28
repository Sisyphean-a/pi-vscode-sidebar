import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
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
  const viewStateSignal = signal<ComposerPickerViewState>(createComposerPickerViewState(state));

  effect(() => {
    syncComposerPickerUi(refs, viewStateSignal.value);
  });

  bindTriggerToggle(refs, state, viewStateSignal);
  bindOptionSelection(options, refs, state, viewStateSignal);
  bindDismissListeners(refs, state, viewStateSignal);
  renderComposerPicker(viewStateSignal, state);

  return {
    hasOption(value) {
      return hasComposerPickerOption(state, value);
    },
    setDisabled(disabled) {
      refs.trigger.disabled = disabled;
      refs.root.classList.toggle("is-disabled", disabled);
      if (disabled) resolveComposerPickerDismissAction(state);
      renderComposerPicker(viewStateSignal, state);
    },
    setFallbackLabel(label) {
      setComposerPickerFallbackLabel(state, label);
      renderComposerPicker(viewStateSignal, state);
    },
    setOptions(nextOptions) {
      setComposerPickerOptions(state, nextOptions);
      renderComposerPicker(viewStateSignal, state);
    },
    setValue(value) {
      setComposerPickerValue(state, value);
      renderComposerPicker(viewStateSignal, state);
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

function bindTriggerToggle(
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  viewStateSignal: { value: ComposerPickerViewState },
): void {
  refs.trigger.addEventListener("click", () => {
    const action = resolveComposerPickerTriggerAction(state, refs.trigger.disabled);
    if (action === "ignore") return;
    if (action === "open") {
      document.dispatchEvent(new CustomEvent("composer-picker:open", { detail: refs.root.id }));
    }
    renderComposerPicker(viewStateSignal, state);
  });
}

function bindOptionSelection(
  options: CreateComposerPickerOptions,
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  viewStateSignal: { value: ComposerPickerViewState },
): void {
  refs.list.addEventListener("click", (event) => {
    const button = readComposerPickerButton(event.target);
    if (!button || button.disabled) return;
    const action = resolveComposerPickerSelectionAction(state, button.dataset.value ?? "");
    if (action.type === "ignore") return;
    renderComposerPicker(viewStateSignal, state);
    if (action.type === "change") {
      options.onChange(action.value);
    }
  });
}

function bindDismissListeners(
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  viewStateSignal: { value: ComposerPickerViewState },
): void {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || refs.root.contains(event.target)) return;
    if (!resolveComposerPickerDismissAction(state)) return;
    renderComposerPicker(viewStateSignal, state);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !resolveComposerPickerDismissAction(state)) return;
    renderComposerPicker(viewStateSignal, state);
  });

  document.addEventListener("composer-picker:open", (event) => {
    const customEvent = event as CustomEvent<string>;
    if (!resolveComposerPickerOpenedElsewhereAction(state, customEvent.detail, refs.root.id)) {
      return;
    }
    renderComposerPicker(viewStateSignal, state);
  });
}

function renderComposerPicker(
  viewStateSignal: { value: ComposerPickerViewState },
  state: ComposerPickerState,
): void {
  viewStateSignal.value = createComposerPickerViewState(state);
}

function readComposerPickerButton(target: EventTarget | null): HTMLButtonElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest<HTMLButtonElement>(".composer-picker-option") ?? undefined;
}

interface ComposerPickerDomRefs {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  list: HTMLElement;
}

interface ComposerPickerViewState {
  currentOptions: Array<{ label: string; value: string }>;
  currentValue: string;
  fallbackLabel: string;
  isOpen: boolean;
}

function createComposerPickerViewState(
  state: Readonly<ComposerPickerState>,
): ComposerPickerViewState {
  return {
    currentOptions: state.currentOptions.map((option) => ({ ...option })),
    currentValue: state.currentValue,
    fallbackLabel: state.fallbackLabel,
    isOpen: state.isOpen,
  };
}

function syncComposerPickerUi(
  refs: ComposerPickerDomRefs,
  state: Readonly<ComposerPickerViewState>,
): void {
  render(
    h(ComposerPickerOptionList, {
      currentOptions: state.currentOptions,
      currentValue: state.currentValue,
    }),
    refs.list,
  );

  const selectedOption = state.currentOptions.find((option) => option.value === state.currentValue);
  refs.trigger.dataset.value = state.currentValue;
  refs.trigger.textContent = selectedOption?.label ?? state.fallbackLabel;
  refs.root.classList.toggle("has-options", state.currentOptions.length > 0);
  refs.root.classList.toggle("is-open", state.isOpen);
  refs.panel.classList.toggle("hidden", !state.isOpen);
  refs.trigger.setAttribute("aria-expanded", state.isOpen ? "true" : "false");
}

interface ComposerPickerOptionListProps {
  currentOptions: Array<{ label: string; value: string }>;
  currentValue: string;
}

function ComposerPickerOptionList(props: ComposerPickerOptionListProps) {
  return props.currentOptions.map((option) => {
    const selected = option.value === props.currentValue;
    return h(
      "button",
      {
        key: option.value,
        type: "button",
        class: `composer-picker-option${selected ? " is-selected" : ""}`,
        "data-value": option.value,
        role: "option",
        "aria-selected": selected ? "true" : "false",
      },
      option.label,
    );
  });
}
