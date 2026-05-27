import {
  collapseActivityGroup,
  refreshActivityGroupSummary,
  rememberActivityGroupLabel,
} from "./activity-transcript-summary.ts";

export type ActivityEntryStatus = "running" | "done" | "info";

export interface ActivityEntryUpdate {
  groupKey: string;
  entryKey: string;
  label: string;
  status: ActivityEntryStatus;
  detail?: string;
  detailSummary?: string;
  family?: string;
}

export interface ActivityEntryState {
  detail?: string;
  detailSummary?: string;
  entryKey: string;
  family?: string;
  label: string;
  status: ActivityEntryStatus;
}

export interface ActivityGroupState {
  collapsed: boolean;
  entries: Map<string, ActivityEntryState>;
  familySet: Set<string>;
  groupKey: string;
  labels: string[];
  summaryText: string;
}

export interface ActivityTranscriptState {
  groups: Map<string, ActivityGroupState>;
}

export function createActivityTranscriptState(): ActivityTranscriptState {
  return {
    groups: new Map<string, ActivityGroupState>(),
  };
}

export function finalizeActivityGroup(
  state: ActivityTranscriptState,
  groupKey: string,
): ActivityGroupState | undefined {
  const group = state.groups.get(groupKey);
  if (!group) return undefined;
  collapseActivityGroup(group);
  return group;
}

export function recordActivityEntry(
  state: ActivityTranscriptState,
  update: ActivityEntryUpdate,
): { entry: ActivityEntryState; group: ActivityGroupState } {
  const group = ensureGroup(state, update.groupKey);
  const entry = ensureEntry(group, update.entryKey);
  entry.status = update.status;
  entry.family = update.family;
  entry.label = update.label;
  entry.detail = update.detail;
  entry.detailSummary = update.detailSummary;
  if (update.family && update.family !== "thinking") group.familySet.add(update.family);
  group.labels = rememberActivityGroupLabel(group.labels, update.label, update.family);
  refreshActivityGroupSummary(group);
  return { entry, group };
}

export function renameActivityEntry(
  state: ActivityTranscriptState,
  groupKey: string,
  fromKey: string,
  toKey: string,
): ActivityEntryState | undefined {
  const group = state.groups.get(groupKey);
  if (!group || fromKey === toKey || group.entries.has(toKey)) return undefined;
  const entry = group.entries.get(fromKey);
  if (!entry) return undefined;
  entry.entryKey = toKey;
  group.entries.set(toKey, entry);
  group.entries.delete(fromKey);
  return entry;
}

export function renameActivityGroup(
  state: ActivityTranscriptState,
  fromKey: string,
  toKey: string,
): ActivityGroupState | undefined {
  if (fromKey === toKey || state.groups.has(toKey)) return undefined;
  const group = state.groups.get(fromKey);
  if (!group) return undefined;
  group.groupKey = toKey;
  state.groups.set(toKey, group);
  state.groups.delete(fromKey);
  return group;
}

export function resetActivityTranscriptState(state: ActivityTranscriptState): void {
  state.groups.clear();
}

function ensureEntry(group: ActivityGroupState, entryKey: string): ActivityEntryState {
  const existing = group.entries.get(entryKey);
  if (existing) return existing;
  const created: ActivityEntryState = {
    entryKey,
    label: "",
    status: "running",
  };
  group.entries.set(entryKey, created);
  return created;
}

function ensureGroup(state: ActivityTranscriptState, groupKey: string): ActivityGroupState {
  const existing = state.groups.get(groupKey);
  if (existing) return existing;
  const created: ActivityGroupState = {
    collapsed: true,
    entries: new Map<string, ActivityEntryState>(),
    familySet: new Set<string>(),
    groupKey,
    labels: [],
    summaryText: "已执行 0 个操作",
  };
  state.groups.set(groupKey, created);
  return created;
}
