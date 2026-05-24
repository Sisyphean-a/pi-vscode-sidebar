# Pi Sidebar Performance Baseline

## 基线信息

- 日期：2026-05-24
- 采样环境：
  - OS: Windows (workspace: `E:\github\pi-vscode-sidebar`)
  - Node/PNPM: 由当前本地开发环境提供
  - 执行命令：`pnpm exec vitest run test/perf/sidebar-stream.perf.test.ts test/perf/bridge-rpc.perf.test.ts --reporter verbose --silent false`
- 样本量：
  - Sidebar stream: 1000 events
  - Bridge RPC: 500 requests

## 实测结果

| 场景 | 指标 | 实测值 |
| --- | --- | --- |
| Sidebar stream | total | `1.194 ms` |
| Sidebar stream | p95 | `0.001000 ms` |
| Bridge RPC | total | `187.480 ms` |
| Bridge RPC | p95 | `0.579100 ms` |
| Bridge RPC | throughput | `2666.953 req/s` |

## 当前阈值（门禁）

阈值由 `test/perf/perf-utils.ts` 的默认值控制，可通过环境变量覆盖：

- `PERF_SIDEBAR_STREAM_P95_MS`（默认 `2`）
- `PERF_BRIDGE_RPC_P95_MS`（默认 `30`）
- `PERF_BRIDGE_RPC_MIN_RPS`（默认 `40`）

## 回归判定规则

1. `sidebar-stream` 的 p95 必须 `<= PERF_SIDEBAR_STREAM_P95_MS`
2. `bridge-rpc` 的 p95 必须 `<= PERF_BRIDGE_RPC_P95_MS`
3. `bridge-rpc` 的吞吐必须 `>= PERF_BRIDGE_RPC_MIN_RPS`

任一违反即 `test:perf` 失败，不允许静默降级。
