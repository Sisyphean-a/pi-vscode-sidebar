import type { AvailableModel, ThinkingLevelMap } from "./model-options.ts";
import { THINKING_LEVEL_ORDER } from "./model-options.ts";
import { asRecord, readString } from "./ui-text.ts";

export function extractAvailableModels(data: unknown): AvailableModel[] | undefined {
  const payload = asRecord(data);
  const models = Array.isArray(payload?.models)
    ? payload.models
    : Array.isArray(asRecord(payload?.data)?.models)
      ? (asRecord(payload?.data)?.models as unknown[])
      : undefined;
  if (!models) return undefined;
  const available: AvailableModel[] = [];
  for (const entry of models) {
    const model = asRecord(entry);
    const provider = readString(model?.provider);
    const id = readString(model?.id);
    if (!provider || !id) continue;
    available.push({
      provider,
      id,
      name: readString(model?.name),
      contextWindow: typeof model?.contextWindow === "number" ? model.contextWindow : undefined,
      reasoning: model?.reasoning === true,
      input: extractModelInput(model?.input),
      thinkingLevelMap: extractThinkingLevelMap(model?.thinkingLevelMap),
    });
  }
  return available;
}

function extractModelInput(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((item): item is string => typeof item === "string");
  return entries.length > 0 ? entries : undefined;
}

function extractThinkingLevelMap(value: unknown): ThinkingLevelMap | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const thinkingLevelMap: ThinkingLevelMap = {};
  let hasEntry = false;
  for (const level of THINKING_LEVEL_ORDER) {
    const entry = record[level];
    if (entry === null) {
      thinkingLevelMap[level] = null;
      hasEntry = true;
      continue;
    }
    const mapped = readString(entry);
    if (!mapped) continue;
    thinkingLevelMap[level] = mapped;
    hasEntry = true;
  }
  return hasEntry ? thinkingLevelMap : undefined;
}
