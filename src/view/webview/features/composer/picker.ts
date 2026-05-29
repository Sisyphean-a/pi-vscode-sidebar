import { h } from "preact";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";
import {
  resolveComposerPickerDismissAction,
  resolveComposerPickerOpenedElsewhereAction,
  resolveComposerPickerSelectionAction,
  resolveComposerPickerTriggerAction,
} from "./picker-actions.ts";
import {
  createComposerPickerState,
  hasComposerPickerOption,
  setComposerPickerFallbackLabel,
  setComposerPickerOptions,
  setComposerPickerValue,
  type ComposerPickerOption,
  type ComposerPickerState,
} from "./picker-state.ts";

export interface ComposerPicker {
  hasOption(value: string): boolean;
  setDisabled(disabled: boolean): void;
  setFallbackLabel(label: string): void;
  setOptions(options: ComposerPickerOption[]): void;
  setValue(value: string): void;
}

interface CreateComposerPickerOptions {
  optionListView: PreactRenderPort;
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  onChange(value: string): void;
}

export function createComposerPicker(options: CreateComposerPickerOptions): ComposerPicker {
  const refs = createComposerPickerRefs(options);
  const state = createComposerPickerState();
  let disabledState = refs.trigger.disabled;

  const sync = () => {
    syncComposerPickerUi(refs, createComposerPickerViewState(state), disabledState);
  };

  bindTriggerToggle(refs, state, sync);
  bindOptionSelection(options, refs, state, sync);
  bindDismissListeners(refs, state, sync);
  sync();

  return {
    hasOption(value) {
      return hasComposerPickerOption(state, value);
    },
    setDisabled(disabled) {
      disabledState = disabled;
      refs.trigger.disabled = disabledState;
      if (disabledState) resolveComposerPickerDismissAction(state);
      sync();
    },
    setFallbackLabel(label) {
      setComposerPickerFallbackLabel(state, label);
      sync();
    },
    setOptions(nextOptions) {
      setComposerPickerOptions(state, nextOptions);
      sync();
    },
    setValue(value) {
      setComposerPickerValue(state, value);
      sync();
    },
  };
}

function createComposerPickerRefs(options: CreateComposerPickerOptions): ComposerPickerDomRefs {
  return {
    optionListView: options.optionListView,
    root: options.root,
    trigger: options.trigger,
    panel: options.panel,
  };
}

function bindTriggerToggle(
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  sync: () => void,
): void {
  refs.trigger.addEventListener("click", () => {
    const action = resolveComposerPickerTriggerAction(state, refs.trigger.disabled);
    if (action === "ignore") return;
    if (action === "open") {
      document.dispatchEvent(new CustomEvent("composer-picker:open", { detail: refs.root.id }));
    }
    sync();
  });
}

function bindOptionSelection(
  options: CreateComposerPickerOptions,
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  sync: () => void,
): void {
  refs.root.addEventListener("click", (event) => {
    const button = readComposerPickerButton(event.target);
    if (!button || button.disabled) return;
    const action = resolveComposerPickerSelectionAction(state, button.dataset.value ?? "");
    if (action.type === "ignore") return;
    sync();
    if (action.type === "change") {
      options.onChange(action.value);
    }
  });
}

function bindDismissListeners(
  refs: ComposerPickerDomRefs,
  state: ComposerPickerState,
  sync: () => void,
): void {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || refs.root.contains(event.target)) return;
    if (!resolveComposerPickerDismissAction(state)) return;
    sync();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !resolveComposerPickerDismissAction(state)) return;
    sync();
  });

  document.addEventListener("composer-picker:open", (event) => {
    const customEvent = event as CustomEvent<string>;
    if (!resolveComposerPickerOpenedElsewhereAction(state, customEvent.detail, refs.root.id)) {
      return;
    }
    sync();
  });
}

function readComposerPickerButton(target: EventTarget | null): HTMLButtonElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.closest<HTMLButtonElement>(".composer-picker-option") ?? undefined;
}

interface ComposerPickerDomRefs {
  optionListView: PreactRenderPort;
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
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
  disabled: boolean,
): void {
  refs.optionListView.render(
    h(ComposerPickerOptionList, {
      currentOptions: state.currentOptions,
      currentValue: state.currentValue,
    }),
  );

  const selectedOption = state.currentOptions.find((option) => option.value === state.currentValue);
  refs.trigger.dataset.value = state.currentValue;
  refs.trigger.textContent = selectedOption?.label ?? state.fallbackLabel;
  refs.root.dataset.hasOptions = state.currentOptions.length > 0 ? "true" : "false";
  refs.root.dataset.isOpen = state.isOpen ? "true" : "false";
  refs.root.dataset.disabled = disabled ? "true" : "false";
  refs.panel.hidden = !state.isOpen;
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
