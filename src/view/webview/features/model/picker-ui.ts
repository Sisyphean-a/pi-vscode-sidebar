import type { ThinkingLevel } from "../../../protocol.ts";
import { createComposerPicker, type ComposerPicker } from "../composer/picker.ts";
import type { AvailableModel } from "./options.ts";
import {
  clampThinkingLevel,
  formatLooseModelLabel,
  formatThinkingLevelLabel,
} from "./options.ts";

export interface ModelPickerControls {
  modelPicker: ComposerPicker;
  thinkingLevelPicker: ComposerPicker;
}

interface CreateModelPickerControlsOptions {
  expectElement<TElement extends HTMLElement>(id: string): TElement;
  onModelChange(value: string): void;
  onThinkingLevelChange(value: string): void;
}

interface RenderModelPickerOptions {
  availableModelValues: readonly string[];
  availableModelsByValue: ReadonlyMap<string, AvailableModel>;
  currentModelValue: string;
  modelLabelByValue: ReadonlyMap<string, string>;
  modelOptionsLoaded: boolean;
}

export function createModelPickerControls(
  options: CreateModelPickerControlsOptions,
): ModelPickerControls {
  return {
    modelPicker: createComposerPicker({
      root: options.expectElement<HTMLElement>("model-picker"),
      trigger: options.expectElement<HTMLButtonElement>("model-picker-trigger"),
      panel: options.expectElement<HTMLElement>("model-picker-panel"),
      list: options.expectElement<HTMLElement>("model-picker-list"),
      onChange(value) {
        options.onModelChange(value);
      },
    }),
    thinkingLevelPicker: createComposerPicker({
      root: options.expectElement<HTMLElement>("thinking-level-picker"),
      trigger: options.expectElement<HTMLButtonElement>("thinking-level-picker-trigger"),
      panel: options.expectElement<HTMLElement>("thinking-level-picker-panel"),
      list: options.expectElement<HTMLElement>("thinking-level-picker-list"),
      onChange(value) {
        options.onThinkingLevelChange(value);
      },
    }),
  };
}

export function renderModelPicker(
  controls: ModelPickerControls,
  options: RenderModelPickerOptions,
): void {
  if (!options.modelOptionsLoaded) {
    renderModelPickerFallback(controls.modelPicker, options.currentModelValue, "加载中");
    return;
  }
  if (options.availableModelValues.length === 0) {
    renderModelPickerFallback(controls.modelPicker, options.currentModelValue, "无可用模型");
    return;
  }

  controls.modelPicker.setOptions(buildModelPickerOptions(options));
  controls.modelPicker.setValue(
    options.currentModelValue && controls.modelPicker.hasOption(options.currentModelValue)
      ? options.currentModelValue
      : "",
  );
  controls.modelPicker.setFallbackLabel("模型");
  controls.modelPicker.setDisabled(false);
}

export function renderThinkingLevelPicker(
  controls: ModelPickerControls,
  preferredLevel: string,
  supportedThinkingLevels: ThinkingLevel[],
): void {
  const nextValue = clampThinkingLevel(supportedThinkingLevels, preferredLevel);
  controls.thinkingLevelPicker.setOptions(
    supportedThinkingLevels.map((level) => ({
      value: level,
      label: formatThinkingLevelLabel(level),
    })),
  );
  controls.thinkingLevelPicker.setValue(nextValue);
  controls.thinkingLevelPicker.setFallbackLabel(formatThinkingLevelLabel(nextValue));
  controls.thinkingLevelPicker.setDisabled(supportedThinkingLevels.length <= 1);
}

function renderModelPickerFallback(
  modelPicker: ComposerPicker,
  currentModelValue: string,
  emptyLabel: string,
): void {
  modelPicker.setOptions(
    currentModelValue
      ? [{ value: currentModelValue, label: formatLooseModelLabel(currentModelValue) }]
      : [],
  );
  modelPicker.setValue(currentModelValue);
  modelPicker.setFallbackLabel(
    currentModelValue ? formatLooseModelLabel(currentModelValue) : emptyLabel,
  );
  modelPicker.setDisabled(true);
}

function buildModelPickerOptions(
  options: RenderModelPickerOptions,
): Array<{ value: string; label: string }> {
  const pickerOptions: Array<{ value: string; label: string }> = [];
  if (options.currentModelValue && !options.availableModelsByValue.has(options.currentModelValue)) {
    pickerOptions.push({
      value: options.currentModelValue,
      label: formatLooseModelLabel(options.currentModelValue),
    });
  }

  for (const value of options.availableModelValues) {
    pickerOptions.push({
      value,
      label: options.modelLabelByValue.get(value) ?? formatLooseModelLabel(value),
    });
  }
  return pickerOptions;
}
