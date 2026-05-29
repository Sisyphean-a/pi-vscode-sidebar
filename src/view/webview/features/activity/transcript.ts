import { h } from "preact";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";
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
  view: PreactRenderPort;
  onChange?(): void;
  resolveView?(): PreactRenderPort | undefined;
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
  let viewState: ActivityTranscriptViewState = { blocks: [] };
  let renderedViewState: ActivityTranscriptViewState | undefined;
  const renderView = () => {
    const view = options.resolveView?.() ?? options.view;
    view.render(h(ActivityTranscriptBlocks, { viewState }));
  };
  renderView();

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
    const nextViewState = buildViewState(state, noteMessagesByKey, blockOrder);
    if (isActivityTranscriptViewStateEqual(renderedViewState, nextViewState)) return;
    viewState = nextViewState;
    renderedViewState = nextViewState;
    renderView();
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

function isActivityTranscriptViewStateEqual(
  left: ActivityTranscriptViewState | undefined,
  right: ActivityTranscriptViewState,
): boolean {
  if (!left) return false;
  return isActivityTranscriptBlockListEqual(left.blocks, right.blocks);
}

function isActivityTranscriptBlockListEqual(
  left: readonly ActivityTranscriptViewBlock[],
  right: readonly ActivityTranscriptViewBlock[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftBlock = left[index];
    const rightBlock = right[index];
    if (!leftBlock || !rightBlock) return false;
    if (leftBlock.kind !== rightBlock.kind) return false;
    if (leftBlock.kind === "note" && rightBlock.kind === "note") {
      if (
        leftBlock.note.key !== rightBlock.note.key ||
        leftBlock.note.message !== rightBlock.note.message
      ) {
        return false;
      }
      continue;
    }
    if (leftBlock.kind === "group" && rightBlock.kind === "group") {
      if (!isActivityGroupViewStateEqual(leftBlock.group, rightBlock.group)) return false;
      continue;
    }
    return false;
  }
  return true;
}

function isActivityGroupViewStateEqual(
  left: ActivityGroupViewState,
  right: ActivityGroupViewState,
): boolean {
  return (
    left.groupKey === right.groupKey &&
    left.summaryText === right.summaryText &&
    left.collapsed === right.collapsed &&
    isActivityEntryViewStateListEqual(left.entries, right.entries)
  );
}

function isActivityEntryViewStateListEqual(
  left: readonly ActivityEntryViewState[],
  right: readonly ActivityEntryViewState[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index];
    const rightEntry = right[index];
    if (!leftEntry || !rightEntry) return false;
    if (
      leftEntry.entryKey !== rightEntry.entryKey ||
      leftEntry.label !== rightEntry.label ||
      leftEntry.status !== rightEntry.status ||
      leftEntry.detail !== rightEntry.detail ||
      leftEntry.detailSummary !== rightEntry.detailSummary
    ) {
      return false;
    }
  }
  return true;
}
