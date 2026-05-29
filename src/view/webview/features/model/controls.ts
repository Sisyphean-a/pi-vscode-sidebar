import type { ThinkingLevel } from "../../../protocol.ts";
import {
  createModelControlState,
  handleQueryResult as handleStateQueryResult,
  requestAvailableModelsOnce,
  requestModelChange,
  requestThinkingLevelChange,
  restorePendingSelections,
  syncRpcState as syncStateRpc,
  type ModelControlQueryResultEvent,
  type ModelControlState,
} from "./control-state.ts";
import { getRenderState, type ModelControlRenderState } from "./control-render.ts";
import {
  renderModelPicker as renderModelPickerUi,
  renderThinkingLevelPicker as renderThinkingLevelPickerUi,
  type ModelPickerControls,
} from "./picker-ui.ts";

interface ModelControlsOptions {
  createPickerControls(handlers: {
    onModelChange(value: string): void;
    onThinkingLevelChange(value: string): void;
  }): ModelPickerControls;
  onImageSupportChange(supported: boolean): void;
  onInlineNote(message: string): void;
  onRequestAvailableModels(): void;
  onRequestModelChange(provider: string, modelId: string): void;
  onRequestThinkingLevelChange(level: ThinkingLevel): void;
}

export interface ModelControls {
  handleHostError(): void;
  handleQueryResult(event: ModelControlQueryResultEvent): boolean;
  requestAvailableModels(): void;
  supportsImageInput(): boolean;
  syncRpcState(rpc: Record<string, unknown> | undefined): void;
}

export function createModelControls(options: ModelControlsOptions): ModelControls {
  const state = createModelControlState();
  let viewState = getRenderState(state);
  const pickerControls = options.createPickerControls({
    onModelChange(value) {
      handleModelPickerChange(state, options, value, refreshViewState);
    },
    onThinkingLevelChange(value) {
      handleThinkingLevelPickerChange(state, options, value, refreshViewState);
    },
  });

  syncView(pickerControls, options, viewState);

  const refreshViewState = () => {
    const nextViewState = getRenderState(state);
    if (isModelControlRenderStateEqual(viewState, nextViewState)) return;
    viewState = nextViewState;
    syncView(pickerControls, options, viewState);
  };

  return {
    handleHostError() {
      restorePendingSelections(state);
      refreshViewState();
    },
    handleQueryResult(event) {
      const outcome = handleStateQueryResult(state, event);
      if (!outcome.consumed) return false;
      refreshViewState();
      if (outcome.note) {
        options.onInlineNote(outcome.note);
      }
      return true;
    },
    requestAvailableModels() {
      if (!requestAvailableModelsOnce(state)) return;
      options.onRequestAvailableModels();
    },
    supportsImageInput() {
      return viewState.supportsImageInput;
    },
    syncRpcState(rpc) {
      syncStateRpc(state, rpc);
      refreshViewState();
    },
  };
}

function handleModelPickerChange(
  state: ModelControlState,
  options: ModelControlsOptions,
  value: string,
  refreshViewState: () => void,
): void {
  const request = requestModelChange(state, value);
  if (!request) return;
  options.onInlineNote(request.note);
  refreshViewState();
  options.onRequestModelChange(request.provider, request.modelId);
}

function handleThinkingLevelPickerChange(
  state: ModelControlState,
  options: ModelControlsOptions,
  value: string,
  refreshViewState: () => void,
): void {
  const level = requestThinkingLevelChange(state, value);
  if (!level) return;
  refreshViewState();
  options.onRequestThinkingLevelChange(level);
}

function syncView(
  pickerControls: ModelPickerControls,
  options: Pick<ModelControlsOptions, "onImageSupportChange">,
  viewState: ModelControlRenderState,
): void {
  renderModelPickerUi(pickerControls, {
    availableModelValues: viewState.availableModelValues,
    availableModelsByValue: viewState.availableModelsByValue,
    currentModelValue: viewState.currentModelValue,
    modelLabelByValue: viewState.modelLabelByValue,
    modelOptionsLoaded: viewState.modelOptionsLoaded,
  });
  renderThinkingLevelPickerUi(
    pickerControls,
    viewState.preferredThinkingLevel,
    viewState.supportedThinkingLevels,
  );
  options.onImageSupportChange(viewState.supportsImageInput);
}

function isModelControlRenderStateEqual(
  left: ModelControlRenderState,
  right: ModelControlRenderState,
): boolean {
  return (
    left.availableModelsByValue === right.availableModelsByValue &&
    left.modelLabelByValue === right.modelLabelByValue &&
    left.currentModelValue === right.currentModelValue &&
    left.modelOptionsLoaded === right.modelOptionsLoaded &&
    left.preferredThinkingLevel === right.preferredThinkingLevel &&
    left.supportsImageInput === right.supportsImageInput &&
    isStringListEqual(left.availableModelValues, right.availableModelValues) &&
    isStringListEqual(left.supportedThinkingLevels, right.supportedThinkingLevels)
  );
}

function isStringListEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
