import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
import {
  createActivityTranscriptState,
  finalizeActivityGroup,
  recordActivityEntry,
  renameActivityEntry,
  renameActivityGroup,
  resetActivityTranscriptState,
  type ActivityEntryState,
  type ActivityEntryStatus,
  type ActivityGroupState,
  type ActivityEntryUpdate,
} from "./transcript-state.ts";

export type { ActivityEntryStatus, ActivityEntryUpdate } from "./transcript-state.ts";

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

interface ActivityTranscriptNoteState {
  key: string;
  message: string;
}

interface ActivityTranscriptViewState {
  blocks: ActivityTranscriptViewBlock[];
}

type ActivityTranscriptViewBlock =
  | { kind: "group"; group: ActivityGroupViewState }
  | { kind: "note"; note: ActivityTranscriptNoteState };

type ActivityTranscriptBlockOrderItem =
  | { kind: "group"; key: string }
  | { kind: "note"; key: string };

interface ActivityGroupViewState {
  collapsed: boolean;
  entries: ActivityEntryViewState[];
  groupKey: string;
  summaryText: string;
}

interface ActivityEntryViewState {
  detail?: string;
  detailSummary?: string;
  entryKey: string;
  label: string;
  status: ActivityEntryStatus;
}

export function createActivityTranscript(options: ActivityTranscriptOptions): ActivityTranscript {
  const state = createActivityTranscriptState();
  const noteMessagesByKey = new Map<string, string>();
  const blockOrder: ActivityTranscriptBlockOrderItem[] = [];
  const groupBlockKeys = new Set<string>();
  const viewStateSignal = signal<ActivityTranscriptViewState>({ blocks: [] });

  effect(() => {
    render(h(ActivityTranscriptBlocks, { viewState: viewStateSignal.value }), options.container);
  });

  return {
    record(update) {
      const isNewGroup = !state.groups.has(update.groupKey);
      const next = recordActivityEntry(state, update);
      if (isNewGroup) {
        ensureGroupBlock(next.group.groupKey);
      }
      refreshViewState();
      options.onChange?.();
    },
    appendNote(key, message) {
      if (!noteMessagesByKey.has(key)) {
        blockOrder.push({ kind: "note", key });
      }
      noteMessagesByKey.set(key, message);
      refreshViewState();
      options.onChange?.();
    },
    renameGroup(fromKey, toKey) {
      if (!renameActivityGroup(state, fromKey, toKey)) return;
      renameGroupBlockKey(fromKey, toKey);
      refreshViewState();
    },
    renameEntry(groupKey, fromKey, toKey) {
      if (!renameActivityEntry(state, groupKey, fromKey, toKey)) return;
      refreshViewState();
    },
    finalizeGroup(groupKey) {
      const groupState = finalizeActivityGroup(state, groupKey);
      if (!groupState) return;
      refreshViewState();
      options.onChange?.();
    },
    reset() {
      noteMessagesByKey.clear();
      blockOrder.length = 0;
      groupBlockKeys.clear();
      resetActivityTranscriptState(state);
      refreshViewState();
      options.onChange?.();
    },
  };

  function ensureGroupBlock(groupKey: string): void {
    if (groupBlockKeys.has(groupKey)) return;
    groupBlockKeys.add(groupKey);
    blockOrder.push({ kind: "group", key: groupKey });
  }

  function renameGroupBlockKey(fromKey: string, toKey: string): void {
    if (fromKey === toKey) return;
    if (groupBlockKeys.has(toKey)) return;
    let renamed = false;
    for (let index = 0; index < blockOrder.length; index += 1) {
      const block = blockOrder[index];
      if (!block) continue;
      if (block.kind !== "group" || block.key !== fromKey) continue;
      blockOrder[index] = { kind: "group", key: toKey };
      renamed = true;
      break;
    }
    if (!renamed) return;
    groupBlockKeys.delete(fromKey);
    groupBlockKeys.add(toKey);
  }

  function refreshViewState(): void {
    viewStateSignal.value = buildViewState(state, noteMessagesByKey, blockOrder);
  }
}

function buildViewState(
  state: ReturnType<typeof createActivityTranscriptState>,
  noteMessagesByKey: ReadonlyMap<string, string>,
  blockOrder: ReadonlyArray<ActivityTranscriptBlockOrderItem>,
): ActivityTranscriptViewState {
  const blocks: ActivityTranscriptViewBlock[] = [];
  for (const block of blockOrder) {
    if (block.kind === "note") {
      const message = noteMessagesByKey.get(block.key);
      if (message) {
        blocks.push({ kind: "note", note: { key: block.key, message } });
      }
      continue;
    }
    const group = state.groups.get(block.key);
    if (!group) continue;
    blocks.push({ kind: "group", group: mapActivityGroupView(group) });
  }
  return { blocks };
}

function mapActivityGroupView(group: ActivityGroupState): ActivityGroupViewState {
  return {
    collapsed: group.collapsed,
    entries: [...group.entries.values()].map(mapActivityEntryView),
    groupKey: group.groupKey,
    summaryText: group.summaryText,
  };
}

function mapActivityEntryView(entry: ActivityEntryState): ActivityEntryViewState {
  return {
    detail: entry.detail,
    detailSummary: entry.detailSummary,
    entryKey: entry.entryKey,
    label: entry.label,
    status: entry.status,
  };
}

function ActivityTranscriptBlocks(props: { viewState: ActivityTranscriptViewState }) {
  return props.viewState.blocks.map((block) => {
    if (block.kind === "note") {
      return h(
        "section",
        {
          class: "chat-activity-note",
          key: `note:${block.note.key}`,
          "data-key": block.note.key,
        },
        block.note.message,
      );
    }
    return h(ActivityGroupBlock, { group: block.group, key: `group:${block.group.groupKey}` });
  });
}

function ActivityGroupBlock(props: { group: ActivityGroupViewState }) {
  return h(
    "details",
    {
      class: "chat-activity-group",
      "data-group-key": props.group.groupKey,
      "data-collapsed": props.group.collapsed ? "true" : "false",
      onToggle(event: Event) {
        const element = event.currentTarget as HTMLDetailsElement | null;
        if (!element) return;
        element.dataset.collapsed = element.open ? "false" : "true";
      },
      open: !props.group.collapsed,
    },
    h("summary", { class: "chat-activity-summary" }, props.group.summaryText),
    h(
      "ol",
      { class: "chat-activity-list" },
      props.group.entries.map((entry) =>
        h(ActivityEntryItem, { entry, key: `entry:${entry.entryKey}` }),
      ),
    ),
  );
}

function ActivityEntryItem(props: { entry: ActivityEntryViewState }) {
  return h(
    "li",
    {
      class: "chat-activity-item",
      "data-entry-key": props.entry.entryKey,
      "data-status": props.entry.status,
    },
    renderActivityEntryBody(props.entry),
  );
}

function renderActivityEntryBody(entry: ActivityEntryViewState) {
  if (entry.detail?.trim()) {
    return h(
      "details",
      { class: "chat-activity-item-detail" },
      h(
        "summary",
        {
          class: "chat-activity-item-detail-summary",
          title: entry.detailSummary ?? "展开详情",
        },
        h("span", { class: "chat-activity-item-label" }, entry.label),
      ),
      h("pre", { class: "chat-activity-item-detail-pre" }, entry.detail),
    );
  }
  return h(
    "div",
    { class: "chat-activity-item-body" },
    h("span", { class: "chat-activity-item-label" }, entry.label),
  );
}
