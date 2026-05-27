# Panel Log View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a configurable Pi log tab in the VS Code bottom panel that shows live structured logs as collapsible rows without retaining hidden-state history.

**Architecture:** Introduce a second panel `webview view` plus a transient host log broadcaster. Keep the existing `OutputChannel` intact, wire the logger to both sinks, and render live log lines in a minimal dedicated webview that starts empty on each resolve.

**Tech Stack:** TypeScript, VS Code extension APIs, webview APIs, Vitest, jsdom

---

### Task 1: Persist the approved design

**Files:**
- Create: `docs/plans/2026-05-27-panel-log-view-design.md`
- Create: `docs/plans/2026-05-27-panel-log-view-implementation.md`

**Step 1: Verify the planning files exist**

Run: `Get-ChildItem docs/plans`

Expected: Both `2026-05-27-panel-log-view-*.md` files are listed.

### Task 2: Add failing tests for transient log broadcasting

**Files:**
- Create: `test/unit/host/log-broadcaster.test.ts`
- Create: `src/host/log-broadcaster.ts`

**Step 1: Write the failing tests**

- Publishing reaches active subscribers.
- Unsubscribed listeners stop receiving entries.
- New subscribers do not receive historical entries.

**Step 2: Run the focused test**

Run: `npm test -- test/unit/host/log-broadcaster.test.ts`

Expected: FAIL because the broadcaster does not exist yet.

**Step 3: Write the minimal implementation**

- Add `createLogBroadcaster`.
- Return `publish(line)` and `subscribe(listener)`.
- Keep the implementation stateless apart from the active subscriber set.

**Step 4: Re-run the focused test**

Run: `npm test -- test/unit/host/log-broadcaster.test.ts`

Expected: PASS

### Task 3: Add failing runtime tests for dual log sinks

**Files:**
- Modify: `test/unit/bootstrap/runtime.test.ts`
- Modify: `src/bootstrap/runtime.ts`

**Step 1: Write the failing tests**

- `setupTraceLogging` still writes to `OutputChannel`.
- `setupTraceLogging` also publishes the same line to the broadcaster.

**Step 2: Run the focused test**

Run: `npm test -- test/unit/bootstrap/runtime.test.ts`

Expected: FAIL because runtime does not accept or use a broadcaster yet.

**Step 3: Write the minimal implementation**

- Create the broadcaster inside bootstrap.
- Pass it into `setupTraceLogging`.
- Publish each emitted log line after writing to the `OutputChannel`.

**Step 4: Re-run the focused test**

Run: `npm test -- test/unit/bootstrap/runtime.test.ts`

Expected: PASS

### Task 4: Add failing provider tests for the panel log view lifecycle

**Files:**
- Create: `test/unit/view/panel-log-provider.test.ts`
- Create: `src/view/panel-log-provider.ts`
- Create: `src/view/panel-log-webview-html.ts`

**Step 1: Write the failing tests**

- The provider renders dedicated log webview HTML.
- The provider subscribes to the broadcaster on resolve.
- Disposing the view unsubscribes the listener.
- Published lines are posted to the webview only while attached.

**Step 2: Run the focused test**

Run: `npm test -- test/unit/view/panel-log-provider.test.ts`

Expected: FAIL because the provider does not exist yet.

**Step 3: Write the minimal implementation**

- Add a dedicated panel log view provider.
- Reuse the existing lightweight provider pattern.
- Post host messages of type `log_entry`.

**Step 4: Re-run the focused test**

Run: `npm test -- test/unit/view/panel-log-provider.test.ts`

Expected: PASS

### Task 5: Add failing webview tests for log row rendering

**Files:**
- Create: `test/unit/view/panel-log-webview.test.ts`
- Create: `src/view/webview/panel-log-app.ts`
- Create: `src/view/webview/panel-log-styles.css`

**Step 1: Write the failing tests**

- `ui_ready` is posted on boot.
- Each `log_entry` renders one collapsed row.
- Parsed JSON shows summary fields and formatted details.
- Invalid JSON renders raw text instead of disappearing.

**Step 2: Run the focused test**

Run: `npm test -- test/unit/view/panel-log-webview.test.ts`

Expected: FAIL because the log webview app does not exist yet.

**Step 3: Write the minimal implementation**

- Build a small DOM-only webview entrypoint.
- Parse log lines defensively.
- Render rows with `<details>` collapsed by default.

**Step 4: Re-run the focused test**

Run: `npm test -- test/unit/view/panel-log-webview.test.ts`

Expected: PASS

### Task 6: Wire extension contributions and registration

**Files:**
- Modify: `package.json`
- Modify: `rolldown.config.ts`
- Modify: `src/bootstrap/activate.ts`
- Modify: `src/bootstrap/commands.ts` if needed

**Step 1: Write/adjust tests first where practical**

- Extend provider/bootstrap tests to cover registration IDs and hidden-context registration options if the seam is testable.

**Step 2: Implement the wiring**

- Contribute `viewsContainers.panel`.
- Contribute `piSidebar.logs`.
- Add activation on `onView:piSidebar.logs`.
- Register the log provider with `retainContextWhenHidden: false`.
- Add `piSidebar.panelLogs.enabled` configuration metadata if supported by the chosen contribution path.

**Step 3: Run focused verification**

Run: `npm test -- test/unit/bootstrap/runtime.test.ts test/unit/view/panel-log-provider.test.ts`

Expected: PASS

### Task 7: Final verification

**Files:**
- Verify all touched files

**Step 1: Run targeted tests**

Run: `npm test -- test/unit/host/log-broadcaster.test.ts test/unit/bootstrap/runtime.test.ts test/unit/view/panel-log-provider.test.ts test/unit/view/panel-log-webview.test.ts`

Expected: PASS

**Step 2: Run full static verification**

Run: `npm run verify`

Expected: PASS
