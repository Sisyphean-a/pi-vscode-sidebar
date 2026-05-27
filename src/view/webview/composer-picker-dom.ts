import type { ComposerPickerState } from "./composer-picker-state.ts";

export interface ComposerPickerDomRefs {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  list: HTMLElement;
}

export function syncComposerPickerUi(
  refs: ComposerPickerDomRefs,
  state: Readonly<ComposerPickerState>,
): void {
  refs.list.replaceChildren(
    ...state.currentOptions.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "composer-picker-option";
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.setAttribute("role", "option");
      return button;
    }),
  );

  const buttons = refs.list.querySelectorAll<HTMLButtonElement>(".composer-picker-option");
  buttons.forEach((button) => {
    const selected = button.dataset.value === state.currentValue;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });

  const selectedOption = state.currentOptions.find((option) => option.value === state.currentValue);
  refs.trigger.dataset.value = state.currentValue;
  refs.trigger.textContent = selectedOption?.label ?? state.fallbackLabel;
  refs.root.classList.toggle("has-options", state.currentOptions.length > 0);
  refs.root.classList.toggle("is-open", state.isOpen);
  refs.panel.classList.toggle("hidden", !state.isOpen);
  refs.trigger.setAttribute("aria-expanded", state.isOpen ? "true" : "false");
}
