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

interface ActivityGroupRefs {
  root: HTMLDetailsElement;
  summary: HTMLElement;
  list: HTMLOListElement;
  familySet: Set<string>;
  labels: string[];
  entries: Map<string, ActivityEntryRefs>;
}

interface ActivityEntryRefs {
  item: HTMLLIElement;
  label: HTMLSpanElement;
  body: HTMLElement;
  detail?: HTMLDetailsElement;
  detailSummary?: HTMLElement;
  detailPre?: HTMLPreElement;
  status: ActivityEntryStatus;
  family?: string;
}

export function createActivityTranscript(options: ActivityTranscriptOptions): ActivityTranscript {
  const groups = new Map<string, ActivityGroupRefs>();

  return {
    record(update) {
      const group = ensureGroup(update.groupKey);
      const entry = ensureEntry(group, update.entryKey);
      entry.status = update.status;
      entry.family = update.family;
      if (update.family && update.family !== "thinking") group.familySet.add(update.family);
      group.labels = rememberGroupLabel(group.labels, update.label, update.family);
      entry.item.dataset.status = update.status;
      entry.label.textContent = update.label;
      applyDetail(entry, update.detail, update.detailSummary);
      if (update.status === "running") expandGroup(group);
      refreshGroupSummary(group);
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
      if (fromKey === toKey || groups.has(toKey)) return;
      const group = groups.get(fromKey);
      if (!group) return;
      group.root.dataset.groupKey = toKey;
      groups.set(toKey, group);
      groups.delete(fromKey);
    },
    renameEntry(groupKey, fromKey, toKey) {
      const group = groups.get(groupKey);
      if (!group || fromKey === toKey || group.entries.has(toKey)) return;
      const entry = group.entries.get(fromKey);
      if (!entry) return;
      entry.item.dataset.entryKey = toKey;
      group.entries.set(toKey, entry);
      group.entries.delete(fromKey);
    },
    finalizeGroup(groupKey) {
      const group = groups.get(groupKey);
      if (!group) return;
      collapseGroup(group);
      options.onChange?.();
    },
    reset() {
      groups.clear();
      const notes = options.container.querySelectorAll(".chat-activity-note");
      notes.forEach((note) => note.remove());
      const activityGroups = options.container.querySelectorAll(".chat-activity-group");
      activityGroups.forEach((group) => group.remove());
      options.onChange?.();
    },
  };

  function ensureGroup(groupKey: string): ActivityGroupRefs {
    const existing = groups.get(groupKey);
    if (existing) return existing;

    const root = document.createElement("details");
    root.className = "chat-activity-group";
    root.dataset.groupKey = groupKey;
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
    options.container.append(root);
    const created: ActivityGroupRefs = {
      root,
      summary,
      list,
      familySet: new Set<string>(),
      labels: [],
      entries: new Map<string, ActivityEntryRefs>(),
    };
    groups.set(groupKey, created);
    return created;
  }

  function ensureEntry(group: ActivityGroupRefs, entryKey: string): ActivityEntryRefs {
    const existing = group.entries.get(entryKey);
    if (existing) return existing;

    const item = document.createElement("li");
    item.className = "chat-activity-item";
    item.dataset.entryKey = entryKey;
    item.dataset.status = "running";

    const body = document.createElement("div");
    body.className = "chat-activity-item-body";

    const label = document.createElement("span");
    label.className = "chat-activity-item-label";

    body.append(label);
    item.append(body);
    group.list.append(item);

    const created: ActivityEntryRefs = { item, label, body, status: "running" };
    group.entries.set(entryKey, created);
    return created;
  }

  function applyDetail(
    entry: ActivityEntryRefs,
    detail: string | undefined,
    detailSummary: string | undefined,
  ): void {
    if (!detail?.trim()) {
      restoreInlineLabel(entry);
      return;
    }

    if (!entry.detail || !entry.detailSummary || !entry.detailPre) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const pre = document.createElement("pre");
      details.className = "chat-activity-item-detail";
      summary.className = "chat-activity-item-detail-summary";
      pre.className = "chat-activity-item-detail-pre";
      summary.append(entry.label);
      details.append(summary, pre);
      details.open = false;
      entry.item.replaceChildren(details);
      entry.body = summary;
      entry.detail = details;
      entry.detailSummary = summary;
      entry.detailPre = pre;
    }

    entry.detailSummary.title = detailSummary ?? "展开详情";
    entry.detailPre.textContent = detail;
  }

  function expandGroup(group: ActivityGroupRefs): void {
    group.root.open = true;
    group.root.dataset.collapsed = "false";
  }

  function refreshGroupSummary(group: ActivityGroupRefs): void {
    const runningEntries = [...group.entries.values()].filter(
      (entry) => entry.status === "running",
    );
    const runningCount = runningEntries.length;
    if (runningCount > 0) {
      group.summary.textContent = runningEntries.every((entry) => entry.family === "thinking")
        ? "正在思考"
        : `正在执行 ${runningCount} 个步骤`;
      group.root.dataset.collapsed = "false";
      return;
    }
    collapseGroup(group);
  }

  function restoreInlineLabel(entry: ActivityEntryRefs): void {
    if (!entry.detail) return;
    const body = document.createElement("div");
    body.className = "chat-activity-item-body";
    body.append(entry.label);
    entry.item.replaceChildren(body);
    entry.body = body;
    entry.detail = undefined;
    entry.detailSummary = undefined;
    entry.detailPre = undefined;
  }
}

function summarizeCompletedGroup(group: ActivityGroupRefs): string {
  const count = group.entries.size;
  const families = [...group.familySet];
  const labelSummary = summarizeGroupLabels(group.labels);
  if (labelSummary) return `执行了：${labelSummary}`;
  if (families.length === 0 && count === 1) {
    const [entry] = [...group.entries.values()];
    if (entry?.family === "thinking") return "已完成思考";
  }
  if (families.length === 1 && families[0] === "command") {
    return `已运行 ${count} 条命令`;
  }
  if (families.length === 1 && families[0] === "codegraph") {
    return count === 1 ? "已使用 Codegraph" : `已使用 Codegraph ${count} 次`;
  }
  if (families.length === 1 && families[0] === "web") {
    return `已搜索网页 ${count} 次`;
  }
  return `已执行 ${count} 个操作`;
}

function collapseGroup(group: ActivityGroupRefs): void {
  group.root.open = false;
  group.root.dataset.collapsed = "true";
  group.summary.textContent = summarizeCompletedGroup(group);
}

function rememberGroupLabel(labels: string[], label: string, family: string | undefined): string[] {
  if (family === "thinking") return labels;
  const normalized = normalizeGroupLabel(label);
  if (!normalized || labels.includes(normalized)) return labels;
  return [...labels, normalized];
}

function normalizeGroupLabel(label: string): string | undefined {
  const prefix = label.split("：")[0]?.trim();
  if (!prefix) return undefined;
  return prefix;
}

function summarizeGroupLabels(labels: string[]): string | undefined {
  if (labels.length === 0) return undefined;
  return labels.join("、");
}
