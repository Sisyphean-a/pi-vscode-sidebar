import type { ActivityGroupState } from "./transcript-state.ts";

export function collapseActivityGroup(group: ActivityGroupState): void {
  group.collapsed = true;
  group.summaryText = summarizeCompletedActivityGroup(group);
}

export function refreshActivityGroupSummary(group: ActivityGroupState): void {
  const runningEntries = [...group.entries.values()].filter((entry) => entry.status === "running");
  const runningCount = runningEntries.length;
  if (runningCount > 0) {
    group.summaryText = runningEntries.every((entry) => entry.family === "thinking")
      ? "正在思考"
      : `正在执行 ${runningCount} 个步骤`;
    group.collapsed = false;
    return;
  }
  collapseActivityGroup(group);
}

export function rememberActivityGroupLabel(
  labels: string[],
  label: string,
  family: string | undefined,
): string[] {
  if (family === "thinking") return labels;
  const normalized = normalizeGroupLabel(label);
  if (!normalized || labels.includes(normalized)) return labels;
  return [...labels, normalized];
}

export function summarizeCompletedActivityGroup(group: ActivityGroupState): string {
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

function normalizeGroupLabel(label: string): string | undefined {
  const prefix = label.split("：")[0]?.trim();
  if (!prefix) return undefined;
  return prefix;
}

function summarizeGroupLabels(labels: string[]): string | undefined {
  if (labels.length === 0) return undefined;
  return labels.join("、");
}
