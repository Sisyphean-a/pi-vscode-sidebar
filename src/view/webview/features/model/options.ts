import type { ThinkingLevel } from "../../../protocol.ts";

export interface AvailableModel {
  provider: string;
  id: string;
  name?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
  thinkingLevelMap?: ThinkingLevelMap;
}

export type ThinkingLevelMap = Partial<Record<ThinkingLevel, string | null>>;

export const THINKING_LEVEL_ORDER: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export function isThinkingLevel(value: string): value is ThinkingLevel {
  return THINKING_LEVEL_ORDER.includes(value as ThinkingLevel);
}

export function buildModelSelectLabel(
  availableModelsByValue: ReadonlyMap<string, AvailableModel>,
  availableModelValues: readonly string[],
  model: AvailableModel,
): string {
  const compact = compactModelName(model.name ?? model.id);
  const duplicateCount = availableModelValues.filter((value) => {
    const available = availableModelsByValue.get(value);
    if (!available) return false;
    return compactModelName(available.name ?? available.id) === compact;
  }).length;
  return duplicateCount > 1 ? `${model.provider} ${compact}` : compact;
}

export function clampThinkingLevel(
  supportedLevels: ThinkingLevel[],
  preferredLevel: string,
): ThinkingLevel {
  const fallbackLevel = supportedLevels[0] ?? "off";
  if (supportedLevels.length === 0) return fallbackLevel;
  if (supportedLevels.includes(preferredLevel as ThinkingLevel)) {
    return preferredLevel as ThinkingLevel;
  }
  const requestedIndex = THINKING_LEVEL_ORDER.indexOf(preferredLevel as ThinkingLevel);
  if (requestedIndex === -1) return fallbackLevel;
  for (let index = requestedIndex; index < THINKING_LEVEL_ORDER.length; index += 1) {
    const candidate = THINKING_LEVEL_ORDER[index];
    if (candidate && supportedLevels.includes(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = THINKING_LEVEL_ORDER[index];
    if (candidate && supportedLevels.includes(candidate)) return candidate;
  }
  return fallbackLevel;
}

export function formatLooseModelLabel(modelValue: string): string {
  const [, rawModelId = modelValue] = modelValue.split("/", 2);
  return compactModelName(rawModelId);
}

export function formatModelValue(model: Pick<AvailableModel, "provider" | "id">): string {
  return `${model.provider}/${model.id}`;
}

export function formatThinkingLevelLabel(level: string): string {
  if (level === "off") return "关闭";
  if (level === "minimal") return "极低";
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  if (level === "xhigh") return "超高";
  return level;
}

export function getSupportedThinkingLevels(model: AvailableModel | undefined): ThinkingLevel[] {
  if (!model) return [...THINKING_LEVEL_ORDER];
  if (!model.reasoning) return ["off"];
  return THINKING_LEVEL_ORDER.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null) return false;
    if (level === "xhigh") return mapped !== undefined;
    return true;
  });
}

export function modelSupportsImageInput(model: AvailableModel | undefined): boolean {
  return !!model?.input?.includes("image");
}

function compactModelName(name: string): string {
  const trimmed = name.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("gpt-")) return trimmed.slice(4).replace(/-/g, " ");
  if (lowered.startsWith("claude-")) return trimmed.slice(7).replace(/-/g, " ");
  if (lowered.startsWith("gemini-")) return trimmed.slice(7).replace(/-/g, " ");
  return trimmed;
}
