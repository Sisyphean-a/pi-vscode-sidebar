export interface ComposerPickerOption {
  value: string;
  label: string;
}

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
  let currentValue = "";
  let currentOptions: ComposerPickerOption[] = [];
  let fallbackLabel = "";

  options.trigger.addEventListener("click", () => {
    if (options.trigger.disabled || currentOptions.length === 0) return;
    if (isOpen()) {
      close();
      return;
    }
    document.dispatchEvent(new CustomEvent("composer-picker:open", { detail: options.root.id }));
    open();
  });

  options.list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>(".composer-picker-option");
    if (!button || button.disabled) return;
    const nextValue = button.dataset.value ?? "";
    close();
    if (!nextValue || nextValue === currentValue) return;
    currentValue = nextValue;
    syncTrigger();
    syncSelection();
    options.onChange(nextValue);
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (options.root.contains(event.target)) return;
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.addEventListener("composer-picker:open", (event) => {
    const customEvent = event as CustomEvent<string>;
    if (customEvent.detail !== options.root.id) close();
  });

  return {
    hasOption(value) {
      return currentOptions.some((option) => option.value === value);
    },
    setDisabled(disabled) {
      options.trigger.disabled = disabled;
      options.root.classList.toggle("is-disabled", disabled);
      if (disabled) close();
    },
    setFallbackLabel(label) {
      fallbackLabel = label;
      syncTrigger();
    },
    setOptions(nextOptions) {
      currentOptions = [...nextOptions];
      renderOptions();
      syncSelection();
      syncTrigger();
      options.root.classList.toggle("has-options", currentOptions.length > 0);
      if (currentOptions.length === 0) close();
    },
    setValue(value) {
      currentValue = value;
      syncSelection();
      syncTrigger();
    },
  };

  function renderOptions(): void {
    options.list.replaceChildren(
      ...currentOptions.map((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "composer-picker-option";
        button.dataset.value = option.value;
        button.textContent = option.label;
        button.setAttribute("role", "option");
        return button;
      }),
    );
  }

  function syncSelection(): void {
    const buttons = options.list.querySelectorAll<HTMLButtonElement>(".composer-picker-option");
    buttons.forEach((button) => {
      const selected = button.dataset.value === currentValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function syncTrigger(): void {
    const selected = currentOptions.find((option) => option.value === currentValue);
    options.trigger.dataset.value = currentValue;
    options.trigger.textContent = selected?.label ?? fallbackLabel;
  }

  function open(): void {
    options.root.classList.add("is-open");
    options.panel.classList.remove("hidden");
    options.trigger.setAttribute("aria-expanded", "true");
  }

  function close(): void {
    options.root.classList.remove("is-open");
    options.panel.classList.add("hidden");
    options.trigger.setAttribute("aria-expanded", "false");
  }

  function isOpen(): boolean {
    return options.root.classList.contains("is-open");
  }
}
