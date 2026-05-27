import { buildModelControlCatalog } from "./model-control-catalog.ts";
import { formatModelValue, formatThinkingLevelLabel } from "./model-options.ts";
import { asRecord, readString } from "./ui-text.ts";
import type { ModelControlState } from "./model-control-state.ts";

export function applyAvailableModelsQueryResult(state: ModelControlState, data: unknown): void {
  const catalog = buildModelControlCatalog(data);
  if (!catalog) return;
  state.availableModelsByValue = catalog.availableModelsByValue;
  state.availableModelValues = catalog.availableModelValues;
  state.modelLabelByValue = catalog.modelLabelByValue;
  state.modelOptionsLoaded = true;
}

export function applyModelCommandResult(state: ModelControlState): string | undefined {
  if (!state.pendingModelValue) return undefined;
  const requested = state.pendingModelValue;
  state.pendingModelValue = "";
  state.currentModelValue = state.lastRpcModelValue || state.currentModelValue;
  if (state.currentModelValue && state.currentModelValue !== requested) {
    return `模型切换未生效，当前仍为 ${state.currentModelValue}`;
  }
  return undefined;
}

export function applyThinkingLevelCommandResult(state: ModelControlState): string | undefined {
  if (!state.pendingThinkingLevel) return undefined;
  const requested = state.pendingThinkingLevel;
  state.pendingThinkingLevel = "";
  const resolved = state.lastRpcThinkingLevel || requested;
  if (resolved !== requested) {
    return `当前模型暂不支持${formatThinkingLevelLabel(requested)}，已保持${formatThinkingLevelLabel(resolved)}`;
  }
  return undefined;
}

export function syncModelControlRpcState(
  state: ModelControlState,
  rpc: Record<string, unknown> | undefined,
): void {
  syncModelSelection(state, rpc);
  syncThinkingLevel(state, rpc);
}

function syncModelSelection(
  state: ModelControlState,
  rpc: Record<string, unknown> | undefined,
): void {
  if (!rpc || !Object.hasOwn(rpc, "model")) return;
  const modelRecord = asRecord(rpc.model);
  const provider = readString(modelRecord?.provider);
  const modelId = readString(modelRecord?.id);
  state.currentModelValue = provider && modelId ? formatModelValue({ provider, id: modelId }) : "";
  state.lastRpcModelValue = state.currentModelValue;
  if (state.pendingModelValue && state.currentModelValue !== state.pendingModelValue) return;
  state.pendingModelValue = "";
}

function syncThinkingLevel(
  state: ModelControlState,
  rpc: Record<string, unknown> | undefined,
): void {
  const nextLevel = readString(rpc?.thinkingLevel);
  if (!nextLevel) return;
  state.lastRpcThinkingLevel = nextLevel;
  if (state.pendingThinkingLevel && nextLevel !== state.pendingThinkingLevel) return;
  state.pendingThinkingLevel = "";
}
