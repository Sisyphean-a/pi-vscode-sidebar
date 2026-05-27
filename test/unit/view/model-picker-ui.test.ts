import { describe, expect, it } from "vitest";

import {
  renderModelPicker,
  renderThinkingLevelPicker,
  type ModelPickerControls,
} from "../../../src/view/webview/model-picker-ui.ts";

describe("model picker ui", () => {
  it("renders model options without implicitly mutating the thinking-level picker", () => {
    const modelPicker = createPickerSpy();
    const thinkingLevelPicker = createPickerSpy();
    const controls: ModelPickerControls = {
      modelPicker: modelPicker.picker,
      thinkingLevelPicker: thinkingLevelPicker.picker,
    };

    renderModelPicker(controls, {
      availableModelValues: ["openai/gpt-5"],
      availableModelsByValue: new Map([
        ["openai/gpt-5", { provider: "openai", id: "gpt-5", reasoning: true }],
      ]),
      currentModelValue: "openai/gpt-5",
      modelLabelByValue: new Map([["openai/gpt-5", "GPT-5"]]),
      modelOptionsLoaded: true,
    });

    expect(modelPicker.calls.setOptions).toEqual([[{ value: "openai/gpt-5", label: "GPT-5" }]]);
    expect(modelPicker.calls.setValue).toEqual(["openai/gpt-5"]);
    expect(modelPicker.calls.setFallbackLabel).toEqual(["模型"]);
    expect(modelPicker.calls.setDisabled).toEqual([false]);
    expect(thinkingLevelPicker.calls.setOptions).toEqual([]);
    expect(thinkingLevelPicker.calls.setValue).toEqual([]);
    expect(thinkingLevelPicker.calls.setFallbackLabel).toEqual([]);
    expect(thinkingLevelPicker.calls.setDisabled).toEqual([]);
  });

  it("renders supported thinking levels and clamps the preferred value", () => {
    const modelPicker = createPickerSpy();
    const thinkingLevelPicker = createPickerSpy();
    const controls: ModelPickerControls = {
      modelPicker: modelPicker.picker,
      thinkingLevelPicker: thinkingLevelPicker.picker,
    };

    renderThinkingLevelPicker(controls, "minimal", ["off", "medium", "high"]);

    expect(thinkingLevelPicker.calls.setOptions).toEqual([
      [
        { value: "off", label: "关闭" },
        { value: "medium", label: "中" },
        { value: "high", label: "高" },
      ],
    ]);
    expect(thinkingLevelPicker.calls.setValue).toEqual(["medium"]);
    expect(thinkingLevelPicker.calls.setFallbackLabel).toEqual(["中"]);
    expect(thinkingLevelPicker.calls.setDisabled).toEqual([false]);
  });
});

interface PickerSpy {
  calls: {
    setDisabled: boolean[];
    setFallbackLabel: string[];
    setOptions: Array<Array<{ value: string; label: string }>>;
    setValue: string[];
  };
  picker: ModelPickerControls["modelPicker"];
}

function createPickerSpy(): PickerSpy {
  const calls = {
    setDisabled: [] as boolean[],
    setFallbackLabel: [] as string[],
    setOptions: [] as Array<Array<{ value: string; label: string }>>,
    setValue: [] as string[],
  };
  return {
    calls,
    picker: {
      hasOption(value) {
        const options = calls.setOptions.at(-1) ?? [];
        return options.some((option) => option.value === value);
      },
      setDisabled(disabled) {
        calls.setDisabled.push(disabled);
      },
      setFallbackLabel(label) {
        calls.setFallbackLabel.push(label);
      },
      setOptions(options) {
        calls.setOptions.push(options.map((option) => ({ ...option })));
      },
      setValue(value) {
        calls.setValue.push(value);
      },
    },
  };
}
