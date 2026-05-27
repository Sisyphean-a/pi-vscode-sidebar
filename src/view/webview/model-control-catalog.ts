import type { AvailableModel } from "./model-options.ts";
import { extractAvailableModels } from "./model-option-readers.ts";
import { buildModelSelectLabel, formatModelValue } from "./model-options.ts";

export interface ModelControlCatalog {
  availableModelsByValue: Map<string, AvailableModel>;
  availableModelValues: string[];
  modelLabelByValue: Map<string, string>;
}

export function buildModelControlCatalog(data: unknown): ModelControlCatalog | undefined {
  const models = extractAvailableModels(data);
  if (!models) return undefined;

  const availableModelsByValue = new Map<string, AvailableModel>();
  const availableModelValues: string[] = [];
  for (const model of models) {
    const value = formatModelValue(model);
    availableModelsByValue.set(value, model);
    availableModelValues.push(value);
  }
  availableModelValues.sort();

  return {
    availableModelsByValue,
    availableModelValues,
    modelLabelByValue: buildModelLabelMap(availableModelsByValue, availableModelValues),
  };
}

export function resolveActiveCatalogModel(
  availableModelsByValue: ReadonlyMap<string, AvailableModel>,
  currentModelValue: string,
  pendingModelValue: string,
): AvailableModel | undefined {
  const modelValue = pendingModelValue || currentModelValue;
  if (!modelValue) return undefined;
  return availableModelsByValue.get(modelValue);
}

function buildModelLabelMap(
  availableModelsByValue: ReadonlyMap<string, AvailableModel>,
  availableModelValues: readonly string[],
): Map<string, string> {
  const modelLabelByValue = new Map<string, string>();
  for (const value of availableModelValues) {
    const model = availableModelsByValue.get(value);
    if (!model) continue;
    modelLabelByValue.set(
      value,
      buildModelSelectLabel(availableModelsByValue, availableModelValues, model),
    );
  }
  return modelLabelByValue;
}
