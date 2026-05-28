import { describe, expect, it } from "vitest";

import {
  closeComposerPicker,
  createComposerPickerState,
  hasComposerPickerOption,
  openComposerPicker,
  selectComposerPickerOption,
  setComposerPickerFallbackLabel,
  setComposerPickerOptions,
  setComposerPickerValue,
} from "../../../src/view/webview/features/composer/picker-state.ts";

describe("composer picker state", () => {
  it("tracks open state transitions", () => {
    const state = createComposerPickerState();

    expect(openComposerPicker(state)).toBe(true);
    expect(openComposerPicker(state)).toBe(false);
    expect(closeComposerPicker(state)).toBe(true);
    expect(closeComposerPicker(state)).toBe(false);
    expect(state.isOpen).toBe(false);
  });

  it("stores copied options and closes when the option list becomes empty", () => {
    const state = createComposerPickerState();
    const options = [{ value: "openai/gpt-5", label: "GPT-5" }];

    openComposerPicker(state);
    setComposerPickerOptions(state, options);
    options[0]!.label = "Changed";

    expect(state.currentOptions).toEqual([{ value: "openai/gpt-5", label: "GPT-5" }]);
    expect(hasComposerPickerOption(state, "openai/gpt-5")).toBe(true);
    expect(state.isOpen).toBe(true);

    setComposerPickerOptions(state, []);

    expect(state.currentOptions).toEqual([]);
    expect(state.isOpen).toBe(false);
  });

  it("only accepts changed selections that exist in the current options", () => {
    const state = createComposerPickerState();
    setComposerPickerFallbackLabel(state, "模型");
    setComposerPickerOptions(state, [
      { value: "openai/gpt-5", label: "GPT-5" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ]);
    setComposerPickerValue(state, "openai/gpt-5");

    expect(selectComposerPickerOption(state, "")).toBe(false);
    expect(selectComposerPickerOption(state, "missing")).toBe(false);
    expect(selectComposerPickerOption(state, "openai/gpt-5")).toBe(false);
    expect(selectComposerPickerOption(state, "openai/gpt-4.1-mini")).toBe(true);
    expect(state.currentValue).toBe("openai/gpt-4.1-mini");
    expect(state.fallbackLabel).toBe("模型");
  });
});
