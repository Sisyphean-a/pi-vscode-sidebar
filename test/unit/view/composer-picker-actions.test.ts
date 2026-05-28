import { describe, expect, it } from "vitest";

import {
  resolveComposerPickerDismissAction,
  resolveComposerPickerOpenedElsewhereAction,
  resolveComposerPickerSelectionAction,
  resolveComposerPickerTriggerAction,
} from "../../../src/view/webview/features/composer/picker-actions.ts";
import {
  createComposerPickerState,
  openComposerPicker,
  setComposerPickerOptions,
  setComposerPickerValue,
} from "../../../src/view/webview/features/composer/picker-state.ts";

describe("composer picker actions", () => {
  it("toggles open state from the trigger and ignores disabled or empty pickers", () => {
    const state = createComposerPickerState();

    expect(resolveComposerPickerTriggerAction(state, false)).toBe("ignore");

    setComposerPickerOptions(state, [{ value: "openai/gpt-5", label: "GPT-5" }]);
    expect(resolveComposerPickerTriggerAction(state, true)).toBe("ignore");
    expect(state.isOpen).toBe(false);

    expect(resolveComposerPickerTriggerAction(state, false)).toBe("open");
    expect(state.isOpen).toBe(true);
    expect(resolveComposerPickerTriggerAction(state, false)).toBe("close");
    expect(state.isOpen).toBe(false);
  });

  it("closes the panel and only emits changes for a different valid option", () => {
    const state = createComposerPickerState();
    setComposerPickerOptions(state, [
      { value: "openai/gpt-5", label: "GPT-5" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ]);
    setComposerPickerValue(state, "openai/gpt-5");
    openComposerPicker(state);

    expect(resolveComposerPickerSelectionAction(state, "openai/gpt-5")).toEqual({
      type: "close",
    });
    expect(state.currentValue).toBe("openai/gpt-5");
    expect(state.isOpen).toBe(false);

    openComposerPicker(state);
    expect(resolveComposerPickerSelectionAction(state, "openai/gpt-4.1-mini")).toEqual({
      type: "change",
      value: "openai/gpt-4.1-mini",
    });
    expect(state.currentValue).toBe("openai/gpt-4.1-mini");
    expect(state.isOpen).toBe(false);
  });

  it("only rerenders dismiss actions when the picker was open", () => {
    const state = createComposerPickerState();
    setComposerPickerOptions(state, [{ value: "openai/gpt-5", label: "GPT-5" }]);

    expect(resolveComposerPickerDismissAction(state)).toBe(false);

    openComposerPicker(state);
    expect(resolveComposerPickerDismissAction(state)).toBe(true);
    expect(state.isOpen).toBe(false);
  });

  it("only closes when another picker opens", () => {
    const state = createComposerPickerState();
    setComposerPickerOptions(state, [{ value: "openai/gpt-5", label: "GPT-5" }]);
    openComposerPicker(state);

    expect(resolveComposerPickerOpenedElsewhereAction(state, "picker-1", "picker-1")).toBe(false);
    expect(state.isOpen).toBe(true);
    expect(resolveComposerPickerOpenedElsewhereAction(state, "picker-2", "picker-1")).toBe(true);
    expect(state.isOpen).toBe(false);
  });
});
