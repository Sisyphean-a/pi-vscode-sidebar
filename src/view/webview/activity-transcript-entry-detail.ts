export interface ActivityEntryDetailRefs {
  body: HTMLElement;
  detail?: HTMLDetailsElement;
  detailPre?: HTMLPreElement;
  detailSummary?: HTMLElement;
  item: HTMLLIElement;
  label: HTMLSpanElement;
}

export function syncActivityEntryDetail(
  entry: ActivityEntryDetailRefs,
  detail: string | undefined,
  detailSummary: string | undefined,
): void {
  if (!detail?.trim()) {
    restoreInlineActivityEntryLabel(entry);
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

function restoreInlineActivityEntryLabel(entry: ActivityEntryDetailRefs): void {
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
