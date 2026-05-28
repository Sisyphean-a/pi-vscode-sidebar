import { signal } from "@preact/signals";
import { render } from "preact";

import { parsePanelLogLine, parsePanelLogMessage } from "./panel-log-message-parsing.ts";

interface LogEntry {
  id: string;
  content: string;
  summary: string;
}

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const app = expectElement<HTMLDivElement>("log-app");
const entriesSignal = signal<LogEntry[]>([]);

window.addEventListener("message", (event) => {
  const message = parsePanelLogMessage(event.data);
  if (!message) return;
  const nextEntry = toLogEntry(message.line);
  entriesSignal.value = [nextEntry, ...entriesSignal.value];
});

render(<PanelLogEntries />, app);
vscode.postMessage({ type: "ui_ready" });

function PanelLogEntries() {
  const entries = entriesSignal.value;
  return (
    <>
      {entries.map((entry) => (
        <details key={entry.id} class="panel-log-entry">
          <summary class="panel-log-summary">{entry.summary}</summary>
          <pre class="panel-log-detail">{entry.content}</pre>
        </details>
      ))}
    </>
  );
}

function toLogEntry(line: string): LogEntry {
  const payload = parsePanelLogLine(line);
  const summary = payload
    ? [
        readText(payload.timestamp),
        readText(payload.level),
        readText(payload.scope),
        readText(payload.message),
      ]
        .filter(Boolean)
        .join("  ")
    : line;
  const content = payload ? JSON.stringify(payload, null, 2) : line;
  return {
    id: createEntryId(),
    content,
    summary,
  };
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as TElement;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function createEntryId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `log-${Date.now().toString(36)}-${randomPart}`;
}
