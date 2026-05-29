import { createPanelLogPresentation, type PanelLogLevelTone } from "./panel-log-presentation.ts";
import { parsePanelLogMessage, type PanelLogUiMessage } from "./panel-log-message-parsing.ts";
import { expectDocumentElementById } from "./ui/dom-elements.ts";
import { createPreactRenderPort } from "./ui/preact-render-port.ts";

interface LogEntry {
  id: string;
  content: string;
  levelLabel: string;
  levelTone: PanelLogLevelTone;
  message: string;
  summaryMeta: readonly string[];
  summaryTime: string;
  timestampIso: string;
}

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<PanelLogUiMessage>();
const app = expectDocumentElementById<HTMLDivElement>("log-app");
const appView = createPreactRenderPort(app);
let entries: LogEntry[] = [];

window.addEventListener("message", (event) => {
  const message = parsePanelLogMessage(event.data);
  if (!message) return;
  if (message.type === "log_reset") {
    entries = [];
    refreshView();
    return;
  }
  if (message.type === "log_history") {
    entries = createHistoryEntries(message.lines);
    refreshView();
    return;
  }
  entries = [toLogEntry(message.line), ...entries];
  refreshView();
});

refreshView();
vscode.postMessage({ type: "ui_ready" });

function refreshView(): void {
  appView.render(<PanelLogEntries entries={entries} />);
}

function PanelLogEntries(props: { entries: LogEntry[] }) {
  if (props.entries.length === 0) {
    return (
      <section class="panel-log-shell">
        <PanelLogToolbar hasEntries={false} />
        <section class="panel-log-empty">
          <h2 class="panel-log-empty-title">等待日志输入</h2>
          <p class="panel-log-empty-copy">Pi RPC 与扩展诊断日志会显示在这里。</p>
        </section>
      </section>
    );
  }
  return (
    <section class="panel-log-shell">
      <PanelLogToolbar hasEntries />
      {props.entries.map((entry) => (
        <PanelLogEntryCard key={entry.id} entry={entry} />
      ))}
    </section>
  );
}

function PanelLogToolbar(props: { hasEntries: boolean }) {
  return (
    <header class="panel-log-toolbar">
      <button
        type="button"
        class="panel-log-toolbar-button"
        title="清空日志"
        aria-label="清空日志"
        disabled={!props.hasEntries}
        onClick={handleClearLogsClick}
      >
        <ClearLogsIcon />
      </button>
    </header>
  );
}

function ClearLogsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M18 6v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PanelLogEntryCard(props: { entry: LogEntry }) {
  const { entry } = props;
  return (
    <details class="panel-log-entry" data-level={entry.levelTone}>
      <summary class="panel-log-summary">
        <span class="panel-log-summary-main">
          {entry.summaryTime ? (
            <time class="panel-log-time" dateTime={entry.timestampIso} title={entry.timestampIso}>
              {entry.summaryTime}
            </time>
          ) : null}
          {entry.levelLabel ? <span class="panel-log-level">{entry.levelLabel}</span> : null}
          <span class="panel-log-message">{entry.message}</span>
        </span>
        {entry.summaryMeta.length > 0 ? (
          <span class="panel-log-summary-meta">
            {entry.summaryMeta.map((meta) => (
              <span key={`${entry.id}-${meta}`} class="panel-log-meta-chip">
                {meta}
              </span>
            ))}
          </span>
        ) : null}
      </summary>
      <pre class="panel-log-detail">{entry.content}</pre>
    </details>
  );
}

function toLogEntry(line: string): LogEntry {
  return {
    id: createEntryId(),
    ...createPanelLogPresentation(line),
  };
}

function createHistoryEntries(lines: readonly string[]): LogEntry[] {
  return [...lines].reverse().map(toLogEntry);
}

function handleClearLogsClick(): void {
  vscode.postMessage({ type: "clear_panel_logs" });
}

function createEntryId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `log-${Date.now().toString(36)}-${randomPart}`;
}
