# Pi VSCode Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Pi VS Code sidebar extension described in the project docs from scratch, with sidebar chat UI, Pi RPC integration, VS Code bridge support, session recovery, and automated verification.

**Architecture:** Start from a minimal VS Code webview extension scaffold, then layer in a host-side controller that owns all session state and Pi RPC communication. Reuse the proven bridge server and serialization patterns from `pi-vscode`, keep UI and host protocol isolated, and grow behavior through red-green test slices.

**Tech Stack:** TypeScript, VS Code Extension API, rolldown, Vitest

---

### Task 1: Scaffold the extension and minimum sidebar view

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `rolldown.config.ts`
- Create: `src/extension.ts`
- Create: `src/view/provider.ts`
- Create: `src/view/webview/app.ts`
- Create: `src/view/webview/styles.css`
- Create: `src/view/protocol.ts`
- Create: `assets/logo.svg`
- Create: `test/unit/view/protocol.test.ts`

**Step 1: Write the failing test**

Add a protocol test that rejects malformed UI messages and accepts valid `send_prompt` payloads.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/view/protocol.test.ts`
Expected: FAIL because protocol helpers do not exist yet.

**Step 3: Write minimal implementation**

Create the extension scaffold, webview provider, typed protocol helpers, and a static sidebar page that boots successfully.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/unit/view/protocol.test.ts`
Expected: PASS

### Task 2: Add host controller, RPC transport, and state model

**Files:**
- Create: `src/host/controller.ts`
- Create: `src/host/process-manager.ts`
- Create: `src/host/rpc-client.ts`
- Create: `src/host/state-store.ts`
- Create: `src/host/message-bus.ts`
- Create: `src/pi/runtime.ts`
- Create: `src/pi/env.ts`
- Create: `src/pi/resolve.ts`
- Create: `src/shared/rpc-types.ts`
- Test: `test/unit/host/process-manager.test.ts`
- Test: `test/unit/host/state-store.test.ts`

**Step 1: Write the failing tests**

Cover JSONL frame parsing, request timeout handling, and the `idle -> streaming -> idle` state transition.

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/unit/host/process-manager.test.ts test/unit/host/state-store.test.ts`
Expected: FAIL because the host modules do not exist yet.

**Step 3: Write minimal implementation**

Implement typed RPC command/response handling, Pi process lifecycle, and host-owned state updates with explicit process-death and abort behavior.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/unit/host/process-manager.test.ts test/unit/host/state-store.test.ts`
Expected: PASS

### Task 3: Reuse VS Code bridge and session persistence

**Files:**
- Create: `src/bridge/server.ts`
- Create: `src/bridge/handlers.ts`
- Create: `src/bridge/serialize.ts`
- Create: `src/bridge/state.ts`
- Create: `src/bridge/types.ts`
- Create: `src/bridge/utils.ts`
- Create: `bridge/pi-vscode-bridge.js`
- Create: `src/session/tracker.ts`
- Test: `test/unit/bridge/server.test.ts`
- Test: `test/unit/session/tracker.test.ts`

**Step 1: Write the failing tests**

Add tests for request authorization, payload limit enforcement, and persisted session cleanup when files disappear.

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/unit/bridge/server.test.ts test/unit/session/tracker.test.ts`
Expected: FAIL because bridge and tracker modules do not exist yet.

**Step 3: Write minimal implementation**

Port the bridge server and core handlers from `pi-vscode`, adapt naming to this extension, inject bridge env into Pi startup, and persist sidebar session mappings.

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/unit/bridge/server.test.ts test/unit/session/tracker.test.ts`
Expected: PASS

### Task 4: Complete sidebar UX and extension UI request loop

**Files:**
- Modify: `src/view/provider.ts`
- Modify: `src/view/webview/app.ts`
- Modify: `src/view/webview/styles.css`
- Modify: `src/host/controller.ts`
- Modify: `src/view/protocol.ts`
- Test: `test/unit/view/provider.test.ts`

**Step 1: Write the failing test**

Add a provider test that verifies extension UI requests are forwarded to the webview and responses flow back to the host.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/view/provider.test.ts`
Expected: FAIL because the provider does not support extension UI loops yet.

**Step 3: Write minimal implementation**

Render messages, tool cards, state banner, input box, session controls, and the four extension UI interaction forms in the sidebar.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/unit/view/provider.test.ts`
Expected: PASS

### Task 5: Run integration checks and project verification

**Files:**
- Create: `test/integration/sidebar-controller.test.ts`
- Modify: `README.md`

**Step 1: Write the failing integration test**

Simulate `start -> prompt -> event stream -> tool event -> completion -> session restore` against the controller with a fake process transport.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/integration/sidebar-controller.test.ts`
Expected: FAIL because the end-to-end flow is not wired yet.

**Step 3: Write minimal implementation**

Finish any missing controller glue, document the extension usage, and align the configuration surface with the design docs.

**Step 4: Run verification**

Run: `pnpm vitest run`
Run: `pnpm lint`
Run: `pnpm typecheck`
Expected: PASS across all commands
