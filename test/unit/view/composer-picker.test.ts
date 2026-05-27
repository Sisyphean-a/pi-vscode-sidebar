// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createComposerPicker } from "../../../src/view/webview/composer-picker.ts";

describe("composer picker", () => {
  it("opens the panel and emits changes when a different option is selected", () => {
    const refs = renderPickerDom("picker-1");
    const onChange = vi.fn();
    const picker = createComposerPicker({
      ...refs,
      onChange,
    });
    picker.setFallbackLabel("模型");
    picker.setOptions([
      { value: "openai/gpt-5", label: "GPT-5" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ]);
    picker.setValue("openai/gpt-5");

    refs.trigger.click();
    expect(refs.root.classList.contains("is-open")).toBe(true);

    const nextButton = refs.list.querySelectorAll<HTMLButtonElement>(".composer-picker-option")[1];
    nextButton?.click();

    expect(onChange).toHaveBeenCalledWith("openai/gpt-4.1-mini");
    expect(refs.trigger.dataset.value).toBe("openai/gpt-4.1-mini");
    expect(refs.trigger.textContent).toBe("GPT-4.1 Mini");
    expect(refs.root.classList.contains("is-open")).toBe(false);
  });

  it("closes when disabled and ignores later trigger clicks", () => {
    const refs = renderPickerDom("picker-2");
    const picker = createComposerPicker({
      ...refs,
      onChange() {},
    });
    picker.setOptions([{ value: "openai/gpt-5", label: "GPT-5" }]);

    refs.trigger.click();
    expect(refs.root.classList.contains("is-open")).toBe(true);

    picker.setDisabled(true);
    refs.trigger.click();

    expect(refs.trigger.disabled).toBe(true);
    expect(refs.root.classList.contains("is-disabled")).toBe(true);
    expect(refs.root.classList.contains("is-open")).toBe(false);
  });
});

function renderPickerDom(id: string): {
  list: HTMLElement;
  panel: HTMLElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
} {
  document.body.innerHTML = `
    <div id="${id}" class="composer-picker">
      <button id="${id}-trigger" type="button"></button>
      <div id="${id}-panel" class="hidden"></div>
      <div id="${id}-list"></div>
    </div>
  `;

  return {
    root: document.getElementById(id) as HTMLElement,
    trigger: document.getElementById(`${id}-trigger`) as HTMLButtonElement,
    panel: document.getElementById(`${id}-panel`) as HTMLElement,
    list: document.getElementById(`${id}-list`) as HTMLElement,
  };
}
