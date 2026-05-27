import type { ThinkingLevel } from "../protocol.ts";
import type { AvailableModel } from "./model-options.ts";
import {
  applyAvailableModelsQueryResult,
  applyModelCommandResult,
  applyThinkingLevelCommandResult,
  syncModelControlRpcState,
} from "./model-control-effects.ts";
import { formatModelValue, isThinkingLevel } from "./model-options.ts";
import { readString } from "./ui-text.ts";

export interface ModelControlState {
  availableModelsByValue: Map<string, AvailableModel>;
  availableModelValues: string[];
  modelLabelByValue: Map<string, string>;
  currentModelValue: string;
  lastRpcModelValue: string;
  lastRpcThinkingLevel: string;
  hasRequestedModels: boolean;
  modelOptionsLoaded: boolean;
  pendingModelValue: string;
  pendingThinkingLevel: string;
}

export interface ModelChangeRequest {
  modelId: string;
  note: string;
  provider: string;
}

export interface QueryResultOutcome {
  consumed: boolean;
  note?: string;
}

export function createModelControlState(): ModelControlState {
  return {
    availableModelsByValue: new Map<string, AvailableModel>(),
    availableModelValues: [],
    modelLabelByValue: new Map<string, string>(),
    currentModelValue: "",
    lastRpcModelValue: "",
    lastRpcThinkingLevel: "",
    hasRequestedModels: false,
    modelOptionsLoaded: false,
    pendingModelValue: "",
    pendingThinkingLevel: "",
  };
}

export function handleQueryResult(
  state: ModelControlState,
  event: Record<string, unknown>,
): QueryResultOutcome {
  const command = readString(event.command);
  if (command === "get_available_models") {
    applyAvailableModelsQueryResult(state, event.data);
    return { consumed: true };
  }
  if (command === "set_thinking_level") {
    return { consumed: true, note: applyThinkingLevelCommandResult(state) };
  }
  if (command === "set_model") {
    return { consumed: true, note: applyModelCommandResult(state) };
  }
  return { consumed: false };
}

export function requestAvailableModelsOnce(state: ModelControlState): boolean {
  if (state.hasRequestedModels) return false;
  state.hasRequestedModels = true;
  return true;
}

export function requestModelChange(
  state: ModelControlState,
  value: string,
): ModelChangeRequest | undefined {
  const model = state.availableModelsByValue.get(value);
  if (!model) return undefined;
  state.pendingModelValue = formatModelValue(model);
  return {
    modelId: model.id,
    note: `已请求切换模型到 ${state.pendingModelValue}`,
    provider: model.provider,
  };
}

export function requestThinkingLevelChange(
  state: ModelControlState,
  value: string,
): ThinkingLevel | undefined {
  if (!isThinkingLevel(value)) return undefined;
  state.pendingThinkingLevel = value;
  return value;
}

export function restorePendingSelections(state: ModelControlState): void {
  state.pendingThinkingLevel = "";
  if (!state.pendingModelValue) return;
  state.pendingModelValue = "";
  state.currentModelValue = state.lastRpcModelValue;
}

export function syncRpcState(
  state: ModelControlState,
  rpc: Record<string, unknown> | undefined,
): void {
  syncModelControlRpcState(state, rpc);
}
