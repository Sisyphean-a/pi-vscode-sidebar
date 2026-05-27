import type { ThinkingLevel } from "../protocol.ts";
import { resolveActiveCatalogModel } from "./model-control-catalog.ts";
import {
  getSupportedThinkingLevels,
  modelSupportsImageInput,
  type AvailableModel,
} from "./model-options.ts";
import type { ModelControlState } from "./model-control-state.ts";

export interface ModelControlRenderState {
  availableModelValues: readonly string[];
  availableModelsByValue: ReadonlyMap<string, AvailableModel>;
  currentModelValue: string;
  modelLabelByValue: ReadonlyMap<string, string>;
  modelOptionsLoaded: boolean;
  preferredThinkingLevel: string;
  supportedThinkingLevels: ThinkingLevel[];
  supportsImageInput: boolean;
}

export function getRenderState(state: ModelControlState): ModelControlRenderState {
  const activeModel = resolveActiveCatalogModel(
    state.availableModelsByValue,
    state.currentModelValue,
    state.pendingModelValue,
  );
  return {
    availableModelValues: state.availableModelValues,
    availableModelsByValue: state.availableModelsByValue,
    currentModelValue: state.currentModelValue,
    modelLabelByValue: state.modelLabelByValue,
    modelOptionsLoaded: state.modelOptionsLoaded,
    preferredThinkingLevel: state.pendingThinkingLevel || state.lastRpcThinkingLevel || "medium",
    supportedThinkingLevels: getSupportedThinkingLevels(activeModel),
    supportsImageInput: modelSupportsImageInput(activeModel),
  };
}
