declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const app = expectElement<HTMLDivElement>("log-app");

window.addEventListener("message", (event) => {
  const data = asRecord(event.data);
  if (!data || data.type !== "log_entry" || typeof data.line !== "string") return;
  app.prepend(renderEntry(data.line));
});

vscode.postMessage({ type: "ui_ready" });

function renderEntry(line: string): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "panel-log-entry";

  const summary = document.createElement("summary");
  summary.className = "panel-log-summary";

  const payload = parseLine(line);
  if (payload) {
    summary.textContent = [
      readText(payload.timestamp),
      readText(payload.level),
      readText(payload.scope),
      readText(payload.message),
    ]
      .filter(Boolean)
      .join("  ");
  } else {
    summary.textContent = line;
  }
  details.append(summary);

  const content = document.createElement("pre");
  content.className = "panel-log-detail";
  content.textContent = payload ? JSON.stringify(payload, null, 2) : line;
  details.append(content);
  return details;
}

function parseLine(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as TElement;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
