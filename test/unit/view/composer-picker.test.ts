// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createComposerPicker } from "../../../src/view/webview/features/composer/picker.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("composer picker", () => {
  it("opens, changes selection, and closes on external dismiss", () => {
    const harness = createHarness("picker-thinking");
    const picker = createComposerPicker(harness.options);

    picker.setOptions([
      { value: "off", label: "关闭" },
      { value: "medium", label: "中" },
    ]);
    picker.setValue("off");

    harness.trigger.click();
    expect(harness.panel.hidden).toBe(false);

    const mediumButton = harness.list.querySelector<HTMLButtonElement>('[data-value="medium"]');
    mediumButton?.click();

    expect(harness.onChange).toHaveBeenCalledWith("medium");
    expect(harness.panel.hidden).toBe(true);

    harness.trigger.click();
    expect(harness.panel.hidden).toBe(false);
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(harness.panel.hidden).toBe(true);
  });
});

function createHarness(rootId: string) {
  document.body.innerHTML = `
    <div id="${rootId}" class="composer-picker">
      <button id="${rootId}-trigger" type="button"></button>
      <div id="${rootId}-panel" class="composer-picker-panel" hidden>
        <div id="${rootId}-list" class="composer-picker-list"></div>
      </div>
    </div>
  `;

  const root = expectElement<HTMLElement>(rootId);
  const trigger = expectElement<HTMLButtonElement>(`${rootId}-trigger`);
  const panel = expectElement<HTMLElement>(`${rootId}-panel`);
  const list = expectElement<HTMLElement>(`${rootId}-list`);
  const onChange = vi.fn();

  return {
    list,
    onChange,
    options: {
      list,
      optionListView: createPreactRenderPort(list),
      onChange,
      panel,
      root,
      trigger,
    },
    panel,
    root,
    trigger,
  };
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
