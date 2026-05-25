# Pi Sidebar Perfection Gates

> 状态口径：`FAIL` = 未达成或证据不足；`PASS` = 达成且证据完整。

## 验收快照（2026-05-24）

- 当前阶段：M5 / Task 8
- 核心验收命令（同日通过）：
  - `npm run lint`
  - `npm run typecheck`
  - `npm exec -- vitest run`
  - `npm run test:e2e`
  - `npm run test:perf`
  - `npm run package:vsix`

## 产品门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | 真实 VSCode 侧边栏可见与激活 | PASS | `npm run test:e2e` | 100% 通过 | `test/e2e/sidebar.e2e.test.ts`, `test/e2e/run-e2e.ts` | Task 2 |
| P-02 | Prompt/事件主链路可验证 | PASS | `npm exec -- vitest run` | 0 fail | `test/integration/sidebar-controller.test.ts` | Task 2/3 |
| P-03 | Extension UI 请求-响应闭环 | PASS | `npm exec -- vitest run` | 0 fail | `test/unit/host/controller.test.ts`, `test/unit/view/extension-ui.test.ts` | Task 2/3 |
| P-04 | Bridge 读写在真实环境可用 | PASS | `npm run test:e2e` | 100% 通过 | `test/e2e/bridge.e2e.test.ts` | Task 2 |

## 质量门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| Q-01 | 单测与集成测试 | PASS | `npm exec -- vitest run` | 0 fail | Vitest 输出：`11 files / 40 tests` | Task 3-6 |
| Q-02 | 静态检查 | PASS | `npm run lint && npm run typecheck` | 0 fail | 本地命令输出 | Task 1-8 |
| Q-03 | 失败场景自动化 | PASS | `npm exec -- vitest run test/unit/bridge/server.test.ts` | 鉴权/超时/非法输入覆盖 | `test/unit/bridge/server.test.ts` | Task 2/5 |
| Q-04 | 总体验证可复现 | PASS | `npm run release:check` | 全 PASS | `scripts/release-check.mjs` + 命令输出 | Task 8 |

## 工程门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | 日志分级生效 | PASS | `npm exec -- vitest run test/unit/host/logger.test.ts` | 0 fail | `src/host/logger.ts`, `test/unit/host/logger.test.ts` | Task 4 |
| E-02 | correlationId 全链路一致 | PASS | `npm exec -- vitest run test/unit/host/controller.test.ts` | 0 fail | `src/view/protocol.ts`, `src/host/controller.ts` | Task 4 |
| E-03 | Bridge 错误模型统一 | PASS | `npm exec -- vitest run test/unit/bridge/server.test.ts` | 0 fail | `src/bridge/server.ts` | Task 5 |
| E-04 | 参数边界强校验 | PASS | `npm exec -- vitest run test/unit/bridge/utils.test.ts` | 0 fail | `src/bridge/utils.ts` | Task 5 |

## 性能门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 流式渲染性能基线 | PASS | `npm run test:perf` | p95 `<= 2ms`（默认） | `test/perf/sidebar-stream.perf.test.ts`, `docs/perf/perf-baseline.md` | Task 6 |
| F-02 | Bridge RPC 吞吐与延迟 | PASS | `npm run test:perf` | p95 `<= 30ms` 且吞吐 `>= 40 rps`（默认） | `test/perf/bridge-rpc.perf.test.ts`, `docs/perf/perf-baseline.md` | Task 6 |

## 发布与运维门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | 发布前阻断检查 | PASS | `npm run release:check` | 0 fail | `scripts/release-check.mjs` | Task 7 |
| R-02 | VSIX 打包可复现 | PASS | `npm run package:vsix` | 产物存在且版本化命名 | `dist/pi-vscode-sidebar-0.0.1.vsix` | Task 7 |
| R-03 | CI PR 门禁稳定 | PASS | 审查 workflow | 必跑项完整 | `.github/workflows/ci.yml` | Task 7 |
| R-04 | Tag 发布流水线 | PASS | 审查 workflow | release job 定义完整 | `.github/workflows/release.yml` | Task 7 |
| R-05 | 回滚手册可执行 | PASS | 文档审计 | 有撤回、兼容、职责与 SLA | `docs/release/release-playbook.md` | Task 7 |

## GA 签署门禁

| Gate ID | 项目 | 状态 | 命令 | 阈值 | 证据位置 | 责任任务 |
| --- | --- | --- | --- | --- | --- | --- |
| GA-01 | 全门禁通过并签署 | PASS | 汇总验证命令集 | 所有门禁 PASS | `docs/quality-gates/ga-signoff-2026-05-24.md` | Task 8 |
