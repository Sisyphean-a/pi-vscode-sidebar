# Sidebar Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an input-box command palette for the VS Code sidebar that executes session commands directly, with sidebar-native UI for `/resume`, `/model`, `/fork`, and `/tree`.

**Architecture:** Split the feature into three boundaries: webview command discovery, host-side command routing, and Pi RPC or sidebar-native command execution. Keep normal prompt submission untouched; commands travel through a dedicated `run_command` / `command_ui_request` / `command_result` protocol. Extend Pi RPC only for `/tree`.

**Tech Stack:** TypeScript, VS Code webview DOM UI, Vitest, Pi RPC mode

---

### Task 1: Add command protocol and failing sidebar tests

**Files:**
- Modify: `src/view/protocol.ts`
- Modify: `src/shared/rpc-types.ts`
- Test: `test/unit/view/protocol.test.ts`
- Test: `test/unit/host/controller.test.ts`

- [ ] **Step 1: Write failing protocol tests for `run_command` and command UI messages**

```ts
it("accepts run_command with raw input", () => {
  expect(
    parseUiMessage({
      type: "run_command",
      name: "compact",
      rawInput: "/compact",
      args: { customInstructions: "focus" },
    }),
  ).toEqual({
    type: "run_command",
    name: "compact",
    rawInput: "/compact",
    args: { customInstructions: "focus" },
  });
});

it("rejects run_command without name", () => {
  expect(parseUiMessage({ type: "run_command", rawInput: "/compact" })).toBeUndefined();
});
```

- [ ] **Step 2: Run the protocol test to verify RED**

Run: `npm test -- test/unit/view/protocol.test.ts`
Expected: FAIL because `run_command` is not part of `UiToHostMessage`

- [ ] **Step 3: Write failing controller tests for command dispatch**

```ts
it("routes run_command compact to rpc compact", async () => {
  await harness.controller.handleUiMessage({
    type: "run_command",
    name: "compact",
    rawInput: "/compact",
  });

  expect(sentCommands).toContainEqual({ type: "compact" });
});

it("emits command ui request for resume", async () => {
  await harness.controller.handleUiMessage({
    type: "run_command",
    name: "resume",
    rawInput: "/resume",
  });

  expect(forwarded.some((item) => item.type === "command_ui_request")).toBe(true);
});
```

- [ ] **Step 4: Run the controller test to verify RED**

Run: `npm test -- test/unit/host/controller.test.ts`
Expected: FAIL because `run_command` is not recognized

- [ ] **Step 5: Implement the minimal protocol types**

```ts
type UiToHostMessagePayload =
  | { type: "run_command"; name: string; rawInput: string; args?: Record<string, unknown> }
  // existing variants...

type HostToUiMessage =
  | { type: "command_ui_request"; data: unknown }
  | { type: "command_result"; data: unknown }
  // existing variants...
```

- [ ] **Step 6: Re-run both tests to verify GREEN**

Run:
- `npm test -- test/unit/view/protocol.test.ts`
- `npm test -- test/unit/host/controller.test.ts`

Expected: protocol tests pass or move to the next missing command-routing failure; controller tests still fail only on missing implementation details

### Task 2: Build host-side command registry and non-`/tree` execution

**Files:**
- Create: `src/host/commands/parser.ts`
- Create: `src/host/commands/registry.ts`
- Create: `src/host/commands/types.ts`
- Create: `src/host/commands/executors.ts`
- Modify: `src/host/controller.ts`
- Test: `test/unit/host/controller.test.ts`
- Test: `test/integration/sidebar-controller.test.ts`

- [ ] **Step 1: Write failing host tests for command parsing and RPC mapping**

```ts
it("maps /name text to set_session_name", async () => {
  await harness.controller.handleUiMessage({
    type: "run_command",
    name: "name",
    rawInput: "/name useful title",
  });

  expect(sentCommands).toContainEqual({
    type: "set_session_name",
    name: "useful title",
  });
});

it("maps /copy to get_last_assistant_text and command_result", async () => {
  rpcResponses.set("get_last_assistant_text", {
    type: "response",
    command: "get_last_assistant_text",
    success: true,
    data: { text: "latest answer" },
  });
  await harness.controller.handleUiMessage({
    type: "run_command",
    name: "copy",
    rawInput: "/copy",
  });

  expect(sentCommands).toContainEqual({ type: "get_last_assistant_text" });
  expect(forwarded.some((item) => item.type === "command_result")).toBe(true);
});
```

- [ ] **Step 2: Run the targeted host tests to verify RED**

Run: `npm test -- test/unit/host/controller.test.ts`
Expected: FAIL because parser / registry / copy flow do not exist

- [ ] **Step 3: Implement minimal parser and registry**

```ts
export interface ParsedSidebarCommand {
  name: string;
  rawInput: string;
  tail: string;
}

export function parseSidebarCommand(rawInput: string): ParsedSidebarCommand | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) return undefined;
  const body = trimmed.slice(1);
  const spaceIndex = body.indexOf(" ");
  const name = (spaceIndex === -1 ? body : body.slice(0, spaceIndex)).trim();
  if (!name) return undefined;
  return {
    name,
    rawInput: trimmed,
    tail: spaceIndex === -1 ? "" : body.slice(spaceIndex + 1).trim(),
  };
}
```

- [ ] **Step 4: Implement controller routing for direct commands**

```ts
case "run_command":
  await this.onRunCommand(message, message.correlationId);
  return;
```

Direct mappings in the first pass:
- `/new` -> `new_session`
- `/compact [text]` -> `compact`
- `/clone` -> `clone`
- `/name <text>` -> `set_session_name`
- `/export [path]` -> `export_html`
- `/copy` -> `get_last_assistant_text` + local clipboard result event

- [ ] **Step 5: Add integration coverage**

```ts
it("handles run_command compact and emits refresh-safe result", async () => {
  await controller.handleUiMessage({
    type: "run_command",
    name: "compact",
    rawInput: "/compact",
  });

  expect(commandTypes).toContain("compact");
});
```

- [ ] **Step 6: Re-run host and integration tests to verify GREEN**

Run:
- `npm test -- test/unit/host/controller.test.ts`
- `npm test -- test/integration/sidebar-controller.test.ts`

Expected: PASS

### Task 3: Build the webview command palette and command result UI

**Files:**
- Create: `src/view/webview/command-palette.ts`
- Create: `src/view/webview/command-ui.ts`
- Modify: `src/view/webview/app.ts`
- Modify: `src/view/webview/template.ts`
- Modify: `src/view/webview/styles.css`
- Test: `test/unit/view/app.test.ts`

- [ ] **Step 1: Write failing webview tests for `/` palette behavior**

```ts
it("opens command palette when input starts with slash", async () => {
  const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
  prompt.value = "/";
  prompt.dispatchEvent(new Event("input"));

  expect(document.querySelector("[data-command-palette]")?.classList.contains("hidden")).toBe(false);
});

it("submits run_command instead of send_prompt for slash command", async () => {
  const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
  prompt.value = "/compact";
  prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

  expect(postedMessages).toContainEqual(
    expect.objectContaining({ type: "run_command", name: "compact", rawInput: "/compact" }),
  );
});
```

- [ ] **Step 2: Run the app test to verify RED**

Run: `npm test -- test/unit/view/app.test.ts`
Expected: FAIL because no command palette exists

- [ ] **Step 3: Implement minimal command palette state and DOM**

```ts
export interface SidebarCommandItem {
  name: string;
  hint?: string;
}

export function shouldOpenCommandPalette(value: string): boolean {
  return value.trimStart().startsWith("/");
}
```

DOM requirements:
- hidden by default
- anchored above composer
- single compact list
- no category headers
- only selected item may show a short hint

- [ ] **Step 4: Implement key handling without breaking normal prompt submit**

Rules:
- slash command -> `run_command`
- non-slash input -> existing `send_prompt`
- `Esc` closes palette and keeps text
- failure results keep composer text intact

- [ ] **Step 5: Implement short command result rendering**

```ts
type CommandResult = { kind: "success" | "error"; message?: string; keepInput?: string };
```

Use short inline feedback near the composer, not chat transcript messages.

- [ ] **Step 6: Re-run app tests to verify GREEN**

Run: `npm test -- test/unit/view/app.test.ts`
Expected: PASS

### Task 4: Add sidebar-native command UI for `/resume`, `/model`, and `/fork`

**Files:**
- Modify: `src/host/controller.ts`
- Modify: `src/session/recent-sessions.ts`
- Modify: `src/view/webview/command-ui.ts`
- Modify: `src/view/webview/app.ts`
- Test: `test/unit/host/controller.test.ts`
- Test: `test/unit/view/app.test.ts`

- [ ] **Step 1: Write failing tests for command UI request flows**

```ts
it("opens resume selector from /resume", async () => {
  await harness.controller.handleUiMessage({
    type: "run_command",
    name: "resume",
    rawInput: "/resume",
  });

  expect(forwarded).toContainEqual(
    expect.objectContaining({
      type: "command_ui_request",
      data: expect.objectContaining({ kind: "session_list" }),
    }),
  );
});

it("submits selected fork entry back to host", async () => {
  // app-level test: clicking a fork option posts command_ui_response
});
```

- [ ] **Step 2: Run the targeted tests to verify RED**

Run:
- `npm test -- test/unit/host/controller.test.ts`
- `npm test -- test/unit/view/app.test.ts`

Expected: FAIL because command UI request/response types are missing

- [ ] **Step 3: Implement command UI request/response protocol**

Use these payload shapes:

```ts
{ kind: "session_list"; commandName: "resume"; items: Array<{ id: string; title: string; meta?: string }> }
{ kind: "model_list"; commandName: "model"; items: Array<{ id: string; title: string; meta?: string }> }
{ kind: "message_list"; commandName: "fork"; items: Array<{ id: string; title: string; meta?: string }> }
```

- [ ] **Step 4: Implement host handlers**

- `/resume` -> recent sessions provider -> `command_ui_request`
- `/model` -> `get_available_models` -> `command_ui_request`
- `/fork` -> `get_fork_messages` -> `command_ui_request`
- `command_ui_response` -> route to `switch_session`, `set_model`, or `fork`

- [ ] **Step 5: Implement compact selector UI**

Requirements:
- overlay stays near composer
- one-column selectable list
- mouse + keyboard support
- no explanatory paragraphs

- [ ] **Step 6: Re-run tests to verify GREEN**

Run:
- `npm test -- test/unit/host/controller.test.ts`
- `npm test -- test/unit/view/app.test.ts`

Expected: PASS

### Task 5: Extend Pi RPC for `/tree` and wire sidebar tree navigation

**Files:**
- Modify: `E:/github/pi/packages/coding-agent/src/modes/rpc/rpc-types.ts`
- Modify: `E:/github/pi/packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- Modify: `src/shared/rpc-types.ts`
- Modify: `src/host/controller.ts`
- Modify: `src/view/webview/command-ui.ts`
- Modify: `src/view/webview/app.ts`
- Test: `E:/github/pi/packages/coding-agent/test/rpc-tree-navigation.test.ts`
- Test: `test/unit/host/controller.test.ts`
- Test: `test/unit/view/app.test.ts`

- [ ] **Step 1: Write failing Pi RPC test for tree listing and navigation**

```ts
it("returns session tree nodes over rpc", async () => {
  const response = await handle({ type: "get_session_tree" });
  expect(response).toEqual({
    type: "response",
    command: "get_session_tree",
    success: true,
    data: expect.objectContaining({ nodes: expect.any(Array), activeEntryId: expect.any(String) }),
  });
});
```

- [ ] **Step 2: Run the Pi targeted test to verify RED**

Run: `node ../../node_modules/vitest/dist/cli.js --run test/rpc-tree-navigation.test.ts`
Workdir: `E:/github/pi/packages/coding-agent`
Expected: FAIL because the RPC commands do not exist

- [ ] **Step 3: Add minimal RPC command and response types**

```ts
| { id?: string; type: "get_session_tree" }
| { id?: string; type: "navigate_session_tree"; entryId: string }
```

Response shape:

```ts
{
  nodes: Array<{
    entryId: string;
    parentEntryId?: string;
    label?: string;
    previewText: string;
    isActive: boolean;
    depth: number;
    hasChildren: boolean;
  }>;
  activeEntryId?: string;
}
```

- [ ] **Step 4: Implement RPC handlers in `rpc-mode.ts`**

Use:
- `session.sessionManager.getTree()` to flatten nodes for `get_session_tree`
- `session.navigateTree(command.entryId, { summarize: false })` for `navigate_session_tree`

- [ ] **Step 5: Wire sidebar `/tree` flow**

- `/tree` -> `get_session_tree` -> `command_ui_request { kind: "session_tree" }`
- selection -> `navigate_session_tree`
- success -> replay messages and close selector

- [ ] **Step 6: Re-run targeted Pi and sidebar tests to verify GREEN**

Run:
- `node ../../node_modules/vitest/dist/cli.js --run test/rpc-tree-navigation.test.ts`
- `npm test -- test/unit/host/controller.test.ts`
- `npm test -- test/unit/view/app.test.ts`

Expected: PASS

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run sidebar targeted tests**

Run:
- `npm test -- test/unit/view/protocol.test.ts`
- `npm test -- test/unit/host/controller.test.ts`
- `npm test -- test/integration/sidebar-controller.test.ts`
- `npm test -- test/unit/view/app.test.ts`

Expected: PASS

- [ ] **Step 2: Run sidebar repo quality gate**

Run: `npm run verify`
Expected: PASS

- [ ] **Step 3: Run Pi targeted tests**

Run:
- `node ../../node_modules/vitest/dist/cli.js --run test/rpc-tree-navigation.test.ts`

Workdir: `E:/github/pi/packages/coding-agent`
Expected: PASS

- [ ] **Step 4: Run Pi repo static gate**

Run: `npm run check`
Workdir: `E:/github/pi`
Expected: PASS
