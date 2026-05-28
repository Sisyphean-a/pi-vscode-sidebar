import type { ThinkingLevel } from "../protocol.ts";
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
} from "./model-control-state.ts";
import { getRenderState } from "./model-control-render.ts";
import {
  createModelPickerControls,
  renderModelPicker as renderModelPickerUi,
  renderThinkingLevelPicker as renderThinkingLevelPickerUi,
  type ModelPickerControls,
} from "./model-picker-ui.ts";

interface ModelControlsOptions {
  expectElement<TElement extends HTMLElement>(id: string): TElement;
  onImageSupportChange(supported: boolean): void;
  onInlineNote(message: string): void;
  onRequestAvailableModels(): void;
  onRequestModelChange(provider: string, modelId: string): void;
  onRequestThinkingLevelChange(level: ThinkingLevel): void;
}

interface ModelControlsRuntime {
  options: ModelControlsOptions;
  pickerControls: ModelPickerControls;
  state: ModelControlState;
}

export interface ModelControls {
  handleHostError(): void;
  handleQueryResult(event: ModelControlQueryResultEvent): boolean;
  requestAvailableModels(): void;
  supportsImageInput(): boolean;
  syncRpcState(rpc: Record<string, unknown> | undefined): void;
}

export function createModelControls(options: ModelControlsOptions): ModelControls {
  let runtime!: ModelControlsRuntime;
  const pickerControls = createModelPickerControls({
    expectElement: options.expectElement,
    onModelChange(value) {
      handleModelPickerChange(runtime, value);
    },
    onThinkingLevelChange(value) {
      handleThinkingLevelPickerChange(runtime, value);
    },
  });

  runtime = {
    options,
    pickerControls,
    state: createModelControlState(),
  };

  renderInitialThinkingLevelPicker(runtime);
  notifyImageSupportChange(runtime);
  return {
    handleHostError() {
      restorePendingSelections(runtime.state);
      render(runtime);
    },
    handleQueryResult(event) {
      const outcome = handleStateQueryResult(runtime.state, event);
      if (!outcome.consumed) return false;
      render(runtime);
      if (outcome.note) {
        runtime.options.onInlineNote(outcome.note);
      }
      return true;
    },
    requestAvailableModels() {
      if (!requestAvailableModelsOnce(runtime.state)) return;
      runtime.options.onRequestAvailableModels();
    },
    supportsImageInput() {
      return getRenderState(runtime.state).supportsImageInput;
    },
    syncRpcState(rpc) {
      syncStateRpc(runtime.state, rpc);
      render(runtime);
    },
  };
}

function handleModelPickerChange(runtime: ModelControlsRuntime, value: string): void {
  const request = requestModelChange(runtime.state, value);
  if (!request) return;
  runtime.options.onInlineNote(request.note);
  render(runtime);
  runtime.options.onRequestModelChange(request.provider, request.modelId);
}

function handleThinkingLevelPickerChange(runtime: ModelControlsRuntime, value: string): void {
  const level = requestThinkingLevelChange(runtime.state, value);
  if (!level) return;
  render(runtime);
  runtime.options.onRequestThinkingLevelChange(level);
}

function notifyImageSupportChange(
  runtime: ModelControlsRuntime,
  supported = getRenderState(runtime.state).supportsImageInput,
): void {
  runtime.options.onImageSupportChange(supported);
}

function render(runtime: ModelControlsRuntime): void {
  const state = getRenderState(runtime.state);
  renderModelPickerUi(runtime.pickerControls, {
    availableModelValues: state.availableModelValues,
    availableModelsByValue: state.availableModelsByValue,
    currentModelValue: state.currentModelValue,
    modelLabelByValue: state.modelLabelByValue,
    modelOptionsLoaded: state.modelOptionsLoaded,
  });
  renderThinkingLevelPickerUi(
    runtime.pickerControls,
    state.preferredThinkingLevel,
    state.supportedThinkingLevels,
  );
  notifyImageSupportChange(runtime, state.supportsImageInput);
}

function renderInitialThinkingLevelPicker(runtime: ModelControlsRuntime): void {
  renderThinkingLevelPickerUi(
    runtime.pickerControls,
    "medium",
    getRenderState(runtime.state).supportedThinkingLevels,
  );
}
