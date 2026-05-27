# Panel Log View Design

**Date:** 2026-05-27

**Goal:** Add a lightweight Pi log tab in the VS Code bottom panel that renders structured log entries as collapsible rows without persisting log history across refreshes or hidden periods.

## Constraints

- The existing host logger already emits one JSON line per entry through `createLogger` in `src/host/logger.ts`.
- The current extension only registers one sidebar `webview view` (`piSidebar.main`) and one raw `OutputChannel`.
- The new log UI must be hideable, should not retain hidden webview context, and should not keep an in-memory history buffer while closed.
- Existing `OutputChannel` logging remains valuable for raw diagnostics and should continue to work.

## Chosen Approach

Add a second `webview view` under a new `panel` views container for Pi logs, and feed it through a transient host-side log broadcaster:

- `package.json` contributes a bottom-panel Pi container and a `piSidebar.logs` webview view.
- The host logger writes to both the existing `OutputChannel` and an ephemeral broadcaster.
- The broadcaster only forwards logs to currently attached listeners; it does not retain history.
- The log webview defaults each entry to collapsed summary + expandable JSON details.
- The view provider is registered with `retainContextWhenHidden: false` so hidden tabs are discarded by VS Code.

## Data Flow

1. `setupTraceLogging` creates the existing `OutputChannel`.
2. The same logger `write(line)` callback also publishes the line to a new broadcaster.
3. `PanelLogViewProvider` subscribes when its webview is resolved and unsubscribes on dispose.
4. Each received line is parsed in the webview and rendered as one collapsed entry.
5. If the view is hidden or reloaded, the webview is recreated empty and only future lines appear.

## UI Behavior

- Position: VS Code bottom panel, alongside other panel tabs.
- Visibility: user can hide the panel tab through normal VS Code view controls.
- Memory model: no retained webview context, no background replay queue, no historical recovery.
- Presentation:
  - one line per log entry
  - summary shows time, level, scope, message
  - details show formatted JSON payload
  - default collapsed

## Configuration

- Add `piSidebar.panelLogs.enabled` to control whether the log tab is contributed.
- Default to `true`.
- Keep `piSidebar.logLevel` unchanged; it still controls which entries are emitted at source.

## Error Handling

- Invalid JSON log lines are shown as raw text rows instead of being silently dropped.
- Webview message parsing remains explicit; no swallow-and-pretend behavior.
- If the log tab is not open, broadcaster publish is a no-op.

## Testing

- Unit tests for the transient broadcaster: only active subscribers receive entries, no replay after unsubscribe.
- Runtime/bootstrap tests for dual output wiring.
- Provider tests for log view subscription lifecycle and webview HTML setup.
- Webview jsdom tests for collapsed log row rendering and expandable detail output.
