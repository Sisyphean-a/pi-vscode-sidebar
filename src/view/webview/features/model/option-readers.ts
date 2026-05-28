import { z } from "zod";
import type { AvailableModel, ThinkingLevelMap } from "./options.ts";
import { THINKING_LEVEL_ORDER } from "./options.ts";

const ThinkingLevelMapSchema = z
  .object({
    off: z.string().nullable().optional(),
    minimal: z.string().nullable().optional(),
    low: z.string().nullable().optional(),
    medium: z.string().nullable().optional(),
    high: z.string().nullable().optional(),
    xhigh: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

const AvailableModelSchema: z.ZodType<AvailableModel> = z.object({
  provider: z.string(),
  id: z.string(),
  name: z.string().optional(),
  contextWindow: z.number().finite().optional(),
  reasoning: z.boolean().optional(),
  input: z.array(z.string()).optional(),
  thinkingLevelMap: ThinkingLevelMapSchema.optional(),
});

const DirectModelsPayloadSchema = z.object({ models: z.array(z.unknown()) }).catchall(z.unknown());
const NestedModelsPayloadSchema = z
  .object({
    data: z.object({ models: z.array(z.unknown()) }).catchall(z.unknown()),
  })
  .catchall(z.unknown());

export function extractAvailableModels(data: unknown): AvailableModel[] | undefined {
  const models = readModelsPayload(data);
  if (!models) return undefined;
  const available: AvailableModel[] = [];
  for (const entry of models) {
    const parsed = AvailableModelSchema.safeParse(entry);
    if (!parsed.success) continue;
    const model = parsed.data;
    available.push({
      provider: model.provider,
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      reasoning: model?.reasoning === true,
      input: extractModelInput(model.input),
      thinkingLevelMap: extractThinkingLevelMap(model.thinkingLevelMap),
    });
  }
  return available;
}

function readModelsPayload(data: unknown): unknown[] | undefined {
  const directPayload = DirectModelsPayloadSchema.safeParse(data);
  if (directPayload.success) return directPayload.data.models;
  const nestedPayload = NestedModelsPayloadSchema.safeParse(data);
  if (nestedPayload.success) return nestedPayload.data.data.models;
  return undefined;
}

function extractModelInput(input: string[] | undefined): string[] | undefined {
  if (!input || input.length === 0) return undefined;
  return [...input];
}

function extractThinkingLevelMap(map: ThinkingLevelMap | undefined): ThinkingLevelMap | undefined {
  if (!map) return undefined;
  const thinkingLevelMap: ThinkingLevelMap = {};
  let hasEntry = false;
  for (const level of THINKING_LEVEL_ORDER) {
    const entry = map[level];
    if (entry === null) {
      thinkingLevelMap[level] = null;
      hasEntry = true;
      continue;
    }
    if (!entry) continue;
    thinkingLevelMap[level] = entry;
    hasEntry = true;
  }
  return hasEntry ? thinkingLevelMap : undefined;
}
