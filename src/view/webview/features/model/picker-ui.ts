import type { ThinkingLevel } from "../../../protocol.ts";
import { createComposerPicker, type ComposerPicker } from "../composer/picker.ts";
import { createPreactRenderPort } from "../../ui/preact-render-port.ts";
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

interface ComposerPickerElements {
  list: HTMLElement;
  panel: HTMLElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
}

interface CreateModelPickerControlsOptions {
  modelPicker: ComposerPickerElements;
  thinkingLevelPicker: ComposerPickerElements;
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
      optionListView: createPreactRenderPort(options.modelPicker.list),
      panel: options.modelPicker.panel,
      root: options.modelPicker.root,
      trigger: options.modelPicker.trigger,
      onChange(value) {
        options.onModelChange(value);
      },
    }),
    thinkingLevelPicker: createComposerPicker({
      optionListView: createPreactRenderPort(options.thinkingLevelPicker.list),
      panel: options.thinkingLevelPicker.panel,
      root: options.thinkingLevelPicker.root,
      trigger: options.thinkingLevelPicker.trigger,
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
