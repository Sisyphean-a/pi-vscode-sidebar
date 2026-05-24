# Pi VSCode Sidebar

Pi VSCode Sidebar is a VS Code extension that runs Pi in RPC mode and uses a sidebar webview as the primary interaction surface.

## Stable Release

- 当前稳定版本：`0.0.1`
- GA 签署：`docs/quality-gates/ga-signoff-2026-05-24.md`
- Perfect 门禁：`docs/quality-gates/perfection-gates.md`

## Requirements

- Node.js `>=22.19.0`
- VS Code `^1.110.0`
- `@earendil-works/pi-coding-agent` `0.75.5` compatible `pi` binary in PATH or via `piSidebar.path`
- Local bridge only (`127.0.0.1`); remote SSH bridge is not supported in this release

## Implemented capabilities

- Sidebar-first chat interaction (`WebviewViewProvider`).
- Pi RPC process management with streaming event relay.
- Abort, new session, session switch, session naming, and HTML export RPC commands.
- Model set + thinking level set + available models query.
- Extension UI request loop (`select`, `confirm`, `input`, `editor`) handled in sidebar and sent back through `extension_ui_response`.
- Local VS Code bridge server (`127.0.0.1`, token auth, request-size limit) with read/write editor methods.
- Bridge tool injection through `bridge/pi-vscode-bridge.js`.
- Session mapping persistence and startup restore attempt.
- Unit and integration tests for protocol, process manager, state transitions, bridge server, session tracker, and controller flow.

## Configuration

The extension contributes these settings:

- `piSidebar.path`: optional absolute Pi binary path.
- `piSidebar.rpcTimeoutMs`: RPC timeout in milliseconds.
- `piSidebar.bridgeEnabled`: enable/disable local VS Code bridge.
- `piSidebar.bridgeRequestTimeoutMs`: bridge RPC request timeout in milliseconds.
- `piSidebar.logLevel`: `error | warn | info | debug`.

## Local development

```bash
pnpm install
pnpm test
pnpm run test:e2e
pnpm run test:perf
pnpm typecheck
pnpm lint
pnpm build
```

## 发布前检查

- 门禁清单：`docs/quality-gates/perfection-gates.md`
- 进度追踪：`docs/quality-gates/progress-tracker.md`
- 最终发布前必须通过：
  - `pnpm verify`
  - `pnpm run test:e2e`
  - `pnpm run test:perf`
  - `pnpm run package:vsix`

## Project layout

```text
src/
  extension.ts
  host/
  view/
  bridge/
  pi/
  session/
  shared/
bridge/
  pi-vscode-bridge.js
test/
  unit/
  integration/
```
