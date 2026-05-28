import type { ActivityGroupResolution } from "./controller-state.ts";
import type { ChatRole, MessageTextMode } from "../conversation/feed-state.ts";
import type { ActivityEntryUpdate } from "./transcript.ts";

export type ActivityControllerEffect =
  | {
      aliases?: string[];
      key: string;
      mode: MessageTextMode;
      role: ChatRole;
      text: string;
      type: "feedMessage";
    }
  | { fromKey: string; toKey: string; type: "renameGroup" }
  | { groupKey: string; type: "finalizeGroup" }
  | { groupKey: string; toolArgs?: string; toolCallId?: string; type: "rememberToolActivity" }
  | { fromKey: string; groupKey: string; toKey: string; type: "renameEntry" }
  | { type: "recordTranscript"; update: ActivityEntryUpdate };

export interface ActivityControllerEffectPlan {
  effects: ActivityControllerEffect[];
}

type FeedMessageSpec = Omit<Extract<ActivityControllerEffect, { type: "feedMessage" }>, "type">;
type RememberToolActivitySpec = Omit<
  Extract<ActivityControllerEffect, { type: "rememberToolActivity" }>,
  "type"
>;

export function createEffectPlan(): ActivityControllerEffectPlan {
  return { effects: [] };
}

export function appendFeedMessage(
  plan: ActivityControllerEffectPlan,
  effect: FeedMessageSpec,
): void {
  plan.effects.push({ ...effect, type: "feedMessage" });
}

export function appendFinalizedGroup(
  plan: ActivityControllerEffectPlan,
  resolution: ActivityGroupResolution,
): void {
  plan.effects.push({ groupKey: resolvePlannedGroupKey(plan, resolution), type: "finalizeGroup" });
}

export function appendRememberToolActivity(
  plan: ActivityControllerEffectPlan,
  effect: RememberToolActivitySpec,
): void {
  plan.effects.push({ ...effect, type: "rememberToolActivity" });
}

export function appendRenameEntry(
  plan: ActivityControllerEffectPlan,
  groupKey: string,
  fromKey: string,
  toKey: string,
): void {
  if (fromKey === toKey) return;
  plan.effects.push({ fromKey, groupKey, toKey, type: "renameEntry" });
}

export function appendTranscriptRecord(
  plan: ActivityControllerEffectPlan,
  update: ActivityEntryUpdate,
): void {
  plan.effects.push({ type: "recordTranscript", update });
}

export function resolvePlannedGroupKey(
  plan: ActivityControllerEffectPlan,
  resolution: ActivityGroupResolution,
): string {
  if (resolution.renameFrom && resolution.renameFrom !== resolution.groupKey) {
    plan.effects.push({
      type: "renameGroup",
      fromKey: resolution.renameFrom,
      toKey: resolution.groupKey,
    });
  }
  return resolution.groupKey;
}
