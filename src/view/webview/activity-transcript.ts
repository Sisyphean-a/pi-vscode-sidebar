import {
  createActivityTranscriptState,
  finalizeActivityGroup,
  recordActivityEntry,
  renameActivityEntry,
  renameActivityGroup,
  resetActivityTranscriptState,
  type ActivityGroupState,
  type ActivityEntryUpdate,
} from "./activity-transcript-state.ts";
import {
  createActivityGroupRefs,
  ensureActivityEntryRefs,
  syncActivityEntryRefs,
  syncActivityGroupRefs,
  type ActivityGroupRefs,
} from "./activity-transcript-dom.ts";

export type { ActivityEntryStatus, ActivityEntryUpdate } from "./activity-transcript-state.ts";

export interface ActivityTranscript {
  record(update: ActivityEntryUpdate): void;
  appendNote(key: string, message: string): void;
  renameGroup(fromKey: string, toKey: string): void;
  renameEntry(groupKey: string, fromKey: string, toKey: string): void;
  finalizeGroup(groupKey: string): void;
  reset(): void;
}

interface ActivityTranscriptOptions {
  container: HTMLElement;
  onChange?(): void;
}

export function createActivityTranscript(options: ActivityTranscriptOptions): ActivityTranscript {
  const groupRefsByKey = new Map<string, ActivityGroupRefs>();
  const state = createActivityTranscriptState();

  return {
    record(update) {
      const next = recordActivityEntry(state, update);
      const group = ensureGroup(next.group);
      const entry = ensureActivityEntryRefs(group, next.entry);
      syncActivityEntryRefs(entry, next.entry);
      syncActivityGroupRefs(group, next.group);
      options.onChange?.();
    },
    appendNote(key, message) {
      const root = document.createElement("section");
      root.className = "chat-activity-note";
      root.dataset.key = key;
      root.textContent = message;
      options.container.append(root);
      options.onChange?.();
    },
    renameGroup(fromKey, toKey) {
      if (!renameActivityGroup(state, fromKey, toKey)) return;
      if (fromKey === toKey || groupRefsByKey.has(toKey)) return;
      const group = groupRefsByKey.get(fromKey);
      if (!group) return;
      group.root.dataset.groupKey = toKey;
      groupRefsByKey.set(toKey, group);
      groupRefsByKey.delete(fromKey);
    },
    renameEntry(groupKey, fromKey, toKey) {
      if (!renameActivityEntry(state, groupKey, fromKey, toKey)) return;
      const group = groupRefsByKey.get(groupKey);
      if (!group || fromKey === toKey || group.entries.has(toKey)) return;
      const entry = group.entries.get(fromKey);
      if (!entry) return;
      entry.item.dataset.entryKey = toKey;
      group.entries.set(toKey, entry);
      group.entries.delete(fromKey);
    },
    finalizeGroup(groupKey) {
      const groupState = finalizeActivityGroup(state, groupKey);
      if (!groupState) return;
      const group = groupRefsByKey.get(groupKey);
      if (!group) return;
      syncActivityGroupRefs(group, groupState);
      options.onChange?.();
    },
    reset() {
      groupRefsByKey.clear();
      resetActivityTranscriptState(state);
      const notes = options.container.querySelectorAll(".chat-activity-note");
      notes.forEach((note) => note.remove());
      const activityGroups = options.container.querySelectorAll(".chat-activity-group");
      activityGroups.forEach((group) => group.remove());
      options.onChange?.();
    },
  };

  function ensureGroup(groupState: ActivityGroupState): ActivityGroupRefs {
    const existing = groupRefsByKey.get(groupState.groupKey);
    if (existing) return existing;
    const created = createActivityGroupRefs(options.container, groupState);
    groupRefsByKey.set(groupState.groupKey, created);
    return created;
  }
}
