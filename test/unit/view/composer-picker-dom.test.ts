// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { syncComposerPickerUi } from "../../../src/view/webview/composer-picker-dom.ts";

describe("composer picker dom", () => {
  it("renders options, marks the selected item, and updates trigger text", () => {
    document.body.innerHTML = `
      <div id="picker-root" class="composer-picker">
        <button id="picker-trigger" type="button"></button>
        <div id="picker-panel" class="hidden"></div>
        <div id="picker-list"></div>
      </div>
    `;

    const root = document.getElementById("picker-root") as HTMLElement;
    const trigger = document.getElementById("picker-trigger") as HTMLButtonElement;
    const panel = document.getElementById("picker-panel") as HTMLElement;
    const list = document.getElementById("picker-list") as HTMLElement;

    syncComposerPickerUi(
      { root, trigger, panel, list },
      {
        currentOptions: [
          { value: "openai/gpt-5", label: "GPT-5" },
          { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
        ],
        currentValue: "openai/gpt-4.1-mini",
        fallbackLabel: "模型",
        isOpen: true,
      },
    );

    const buttons = list.querySelectorAll<HTMLButtonElement>(".composer-picker-option");
    expect(buttons).toHaveLength(2);
    expect(buttons[1]?.classList.contains("is-selected")).toBe(true);
    expect(buttons[1]?.getAttribute("aria-selected")).toBe("true");
    expect(trigger.textContent).toBe("GPT-4.1 Mini");
    expect(trigger.dataset.value).toBe("openai/gpt-4.1-mini");
    expect(root.classList.contains("has-options")).toBe(true);
    expect(root.classList.contains("is-open")).toBe(true);
    expect(panel.classList.contains("hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});
