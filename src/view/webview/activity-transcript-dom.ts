import type {
  ActivityEntryState,
  ActivityEntryStatus,
  ActivityGroupState,
} from "./activity-transcript-state.ts";
import {
  syncActivityEntryDetail,
  type ActivityEntryDetailRefs,
} from "./activity-transcript-entry-detail.ts";

export interface ActivityGroupRefs {
  entries: Map<string, ActivityEntryRefs>;
  list: HTMLOListElement;
  root: HTMLDetailsElement;
  summary: HTMLElement;
}

export interface ActivityEntryRefs extends ActivityEntryDetailRefs {
  family?: string;
  item: HTMLLIElement;
  label: HTMLSpanElement;
  status: ActivityEntryStatus;
}

export function createActivityGroupRefs(
  container: HTMLElement,
  groupState: ActivityGroupState,
): ActivityGroupRefs {
  const root = document.createElement("details");
  root.className = "chat-activity-group";
  root.dataset.groupKey = groupState.groupKey;
  root.dataset.collapsed = "true";
  root.open = false;
  root.addEventListener("toggle", () => {
    root.dataset.collapsed = root.open ? "false" : "true";
  });

  const summary = document.createElement("summary");
  summary.className = "chat-activity-summary";
  summary.textContent = "已执行 0 个操作";

  const list = document.createElement("ol");
  list.className = "chat-activity-list";

  root.append(summary, list);
  container.append(root);
  return {
    root,
    summary,
    list,
    entries: new Map<string, ActivityEntryRefs>(),
  };
}

export function ensureActivityEntryRefs(
  group: ActivityGroupRefs,
  entryState: ActivityEntryState,
): ActivityEntryRefs {
  const existing = group.entries.get(entryState.entryKey);
  if (existing) return existing;

  const item = document.createElement("li");
  item.className = "chat-activity-item";
  item.dataset.entryKey = entryState.entryKey;
  item.dataset.status = "running";

  const body = document.createElement("div");
  body.className = "chat-activity-item-body";

  const label = document.createElement("span");
  label.className = "chat-activity-item-label";

  body.append(label);
  item.append(body);
  group.list.append(item);

  const created: ActivityEntryRefs = { item, label, body, status: "running" };
  group.entries.set(entryState.entryKey, created);
  return created;
}

export function syncActivityEntryRefs(
  entryRefs: ActivityEntryRefs,
  entryState: ActivityEntryState,
): void {
  entryRefs.status = entryState.status;
  entryRefs.family = entryState.family;
  entryRefs.item.dataset.status = entryState.status;
  entryRefs.label.textContent = entryState.label;
  syncActivityEntryDetail(entryRefs, entryState.detail, entryState.detailSummary);
}

export function syncActivityGroupRefs(
  groupRefs: ActivityGroupRefs,
  groupState: ActivityGroupState,
): void {
  groupRefs.root.open = !groupState.collapsed;
  groupRefs.root.dataset.collapsed = groupState.collapsed ? "true" : "false";
  groupRefs.summary.textContent = groupState.summaryText;
}
