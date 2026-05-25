# Pi Sidebar Perfect Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有“功能已完成且本地自动化通过”的基础上，补齐真实 E2E、可观测性、安全与发布流水线，交付可持续维护且可稳定发布的 Perfect 版本。

**Architecture:** 保持 `host / view / bridge / pi / session / shared` 既有分层不变，以“失败先行（红）→ 最小实现（绿）→ 回归收口（重构）”推进。先建立门禁与真实 E2E，再补 UI 协议、日志与安全，最后收口性能与发布并做 GA 冻结验收。

**Tech Stack:** TypeScript, VSCode Extension API, Vitest, @vscode/test-electron, rolldown, npm, GitHub Actions

---

## 执行规则（强约束）

1. 禁静默降级：所有失败必须显式暴露（测试红、命令非 0、错误日志）。
2. 每个任务必须先写失败验证，再写实现；未出现“可解释的失败”不得进入实现步骤。
3. 每个任务完成时必须更新门禁证据，不接受“代码已改但无证据”。
4. 每个任务结束必须有可复现命令；命令缺失视为未完成。

## 当前基线（2026-05-24 实际仓库快照）

1. 已完成主链路与关键约束：见 `docs/completion-audit-2026-05-24.md`。
2. 当前脚本：`build / dev / format / lint / typecheck / test / verify`，暂无 `test:e2e`、`test:perf`、`package:vsix`、`release:check`。
3. 当前自动化通过：`npm run lint`、`npm run typecheck`、`npm exec -- vitest run`、`npm run build`。
4. 当前缺口：真实 VSCode E2E、extension UI 非交互 method（`notify`/`setStatus`/`setTitle`/`set_editor_text`）可视化、日志分级与关联 ID、性能门禁、CI/CD 发布链路。

## 完美阶段门禁定义（最终验收口径）

1. 产品门禁：真实 VSCode 中侧边栏会话、工具事件、extension UI、bridge 读写均可稳定运行。
2. 质量门禁：单测 + 集成 + 真实 E2E + 失败场景测试全自动化并持续绿。
3. 工程门禁：日志分级、关联 ID、错误模型、性能基线、容量边界均可验证。
4. 发布门禁：`.vsix` 可一键构建，发布前检查可阻断，具备回滚流程。
5. 运维门禁：故障可定位、可恢复、可追溯，文档可支持新人独立操作。

### Task 1: 建立 Perfect 门禁清单与追踪面板

**Files:**
- Create: `docs/quality-gates/perfection-gates.md`
- Create: `docs/quality-gates/progress-tracker.md`
- Modify: `README.md`

**Step 1: 创建空门禁（默认 FAIL）**

创建 `perfection-gates.md`，按“产品/质量/工程/发布/运维”五大类逐条列出门禁，状态初始全部为 `FAIL`，证据列为 `TBD`。

**Step 2: 记录当前基线命令结果**

Run: `npm run verify`  
Expected: PASS（门禁文档仍保持 FAIL，禁止提前改 PASS）

**Step 3: 为每条门禁补齐量化阈值**

为每条门禁补充固定字段：`命令` / `阈值` / `证据位置` / `责任任务`。  
示例阈值：`E2E 成功率 100%`、`Bridge 鉴权绕过 0`、`性能回归不超过基线 10%`。

**Step 4: 建立进度追踪板**

在 `progress-tracker.md` 建立任务看板：`状态`、`阻塞项`、`最新证据链接`、`下一检查点`。

**Step 5: 更新 README 发布前入口**

在 README 增加“发布前检查”章节，链接门禁文档和追踪板。

**Step 6: 本任务收口验证**

Run: `npm run verify`  
Expected: PASS，且 `perfection-gates.md` 仍包含至少 1 个 `FAIL`（表示门禁机制有效）。

### Task 2: 补齐真实 VSCode E2E（非模拟）

**Files:**
- Create: `test/e2e/bootstrap.ts`
- Create: `test/e2e/sidebar.e2e.test.ts`
- Create: `test/e2e/bridge.e2e.test.ts`
- Create: `test/e2e/run-e2e.ts`
- Modify: `package.json`

**Step 1: 写第一批失败 E2E（侧边栏可见性）**

使用 `@vscode/test-electron` 启动真实 Extension Host，断言 `piSidebar.main` 可见与 `piSidebar.focus` 可执行。

**Step 2: 跑失败用例确认断言有效**

Run: `npm exec -- tsx test/e2e/run-e2e.ts`  
Expected: FAIL（常见为 `Cannot find module 'tsx'` 或 `view not found / activation timeout`）

**Step 3: 接通 E2E 启动脚本与依赖**

新增必要依赖（`@vscode/test-electron`、`tsx`）并实现 `bootstrap.ts`（下载 VSCode、准备测试工作区、启动测试入口）。

**Step 4: 扩展核心链路 E2E**

覆盖 `prompt -> message_update -> tool events -> agent_end`，以及 `extension_ui_request -> respond_extension_ui` 闭环。

**Step 5: 增加脚本并跑全量 E2E**

Modify `package.json` scripts: `test:e2e`。  
Run: `npm run test:e2e`  
Expected: PASS

**Step 6: 失败场景 E2E**

增加至少两条失败路径：`RPC 超时`、`bridge token 错误`，确保 UI 与日志显式暴露失败。

### Task 3: 扩展 UI 交互能力补齐到全协议

**Files:**
- Modify: `src/view/webview/extension-ui.ts`
- Modify: `src/view/webview/app.ts`
- Modify: `src/view/protocol.ts`
- Test: `test/unit/view/extension-ui.test.ts`
- Test: `test/integration/sidebar-controller.test.ts`

**Step 1: 先写失败单测（四个缺口 method）**

为 `notify` / `setStatus` / `setTitle` / `set_editor_text` 分别写可见行为断言。

**Step 2: 运行单测确认失败**

Run: `npm exec -- vitest run test/unit/view/extension-ui.test.ts`  
Expected: FAIL

**Step 3: 最小实现协议行为**

1. `notify`：渲染通知卡片（级别+文本）；  
2. `setStatus`：更新顶部状态区；  
3. `setTitle`：更新页面标题；  
4. `set_editor_text`：打开可编辑文本区并支持提交/取消。

**Step 4: 联调 controller 集成测试**

Run: `npm exec -- vitest run test/integration/sidebar-controller.test.ts`  
Expected: PASS

**Step 5: 全量回归**

Run: `npm exec -- vitest run`  
Expected: PASS（不得引入现有行为回退）

### Task 4: 日志分级与全链路 correlationId 落地

**Files:**
- Create: `src/host/logger.ts`
- Modify: `src/extension.ts`
- Modify: `src/host/process-manager.ts`
- Modify: `src/host/controller.ts`
- Test: `test/unit/host/logger.test.ts`
- Test: `test/unit/host/controller.test.ts`

**Step 1: 写失败测试（日志级别过滤）**

验证 `piSidebar.logLevel` 对 `error/warn/info/debug` 的过滤行为。

**Step 2: 实现统一 Logger 抽象**

日志结构统一为：`timestamp / level / scope / correlationId / message / details`。

**Step 3: 打通 correlationId**

从 `UiToHostMessage` 发起点到 `rpc_command_sent` 与 `rpc_response` 保持同一关联 ID，并在错误日志中带出。

**Step 4: 跑单测与回归**

Run: `npm exec -- vitest run test/unit/host/logger.test.ts test/unit/host/controller.test.ts`  
Expected: PASS

**Step 5: 证据沉淀**

将日志样例与级别矩阵写入 `docs/quality-gates/perfection-gates.md` 对应条目。

### Task 5: Bridge 安全与参数验证加强

**Files:**
- Modify: `src/bridge/server.ts`
- Modify: `src/bridge/utils.ts`
- Modify: `src/bridge/handlers-write.ts`
- Test: `test/unit/bridge/server.test.ts`
- Test: `test/unit/bridge/utils.test.ts`

**Step 1: 先写失败测试（边界与恶意输入）**

覆盖项：超长字符串、非法 range、未知 method、空 token、header 大小写变体、非对象 params。

**Step 2: 统一错误模型**

HTTP 响应统一为 `{ code, message, details }`，禁止仅返回模糊字符串。

**Step 3: 强化高风险写操作约束**

对 `applyWorkspaceEdit` 与 `executeCodeAction` 增加参数上限与审计字段（如 edit 数量、文本长度、action 来源）。

**Step 4: 运行桥接测试**

Run: `npm exec -- vitest run test/unit/bridge/server.test.ts test/unit/bridge/utils.test.ts`  
Expected: PASS

**Step 5: 安全门禁更新**

将“鉴权失败/参数越界/未知方法”三类失败证据写入门禁文档。

### Task 6: 性能基线与回归门禁

**Files:**
- Create: `test/perf/sidebar-stream.perf.test.ts`
- Create: `test/perf/bridge-rpc.perf.test.ts`
- Create: `docs/perf/perf-baseline.md`
- Modify: `package.json`

**Step 1: 编写性能测试并先采样**

场景 A：流式 1000 事件渲染耗时。  
场景 B：bridge 500 请求吞吐、p50/p95 延迟。

**Step 2: 首次基线采集**

Run: `npm run test:perf`（首次可允许记录模式，不设硬阈值阻断）  
Expected: PASS + 生成可追溯统计输出。

**Step 3: 固化阈值**

将首次稳定样本写入 `docs/perf/perf-baseline.md`，记录 CPU、内存、Node 版本、样本量、统计方法。

**Step 4: 开启性能回归阻断**

将 `test:perf` 切换到阈值校验模式，回归超过阈值（建议 10%）直接 FAIL。

### Task 7: 发布工程化（打包、校验、回滚）

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `CHANGELOG.md`
- Create: `docs/release/release-playbook.md`

**Step 1: 写发布前阻断检查**

新增 `release:check`，至少检查：版本号变更、CHANGELOG 更新、`verify + test:e2e + test:perf` 全绿。

**Step 2: 增加打包脚本**

新增 `package:vsix`，产出 `.vsix` 并记录构建版本号与 hash。

**Step 3: CI 主流水线**

PR 触发：`lint/typecheck/vitest/test:e2e/test:perf`。  
任一失败即阻断合并。

**Step 4: Release 流水线**

Tag 触发：`release:check -> package:vsix -> 上传发布资产`。

**Step 5: 回滚手册**

在 `docs/release/release-playbook.md` 明确“撤回版本、升级提示、兼容策略、责任人响应时限”。

### Task 8: 最终 GA 冻结验收（Perfect Gate）

**Files:**
- Modify: `docs/quality-gates/perfection-gates.md`
- Create: `docs/quality-gates/ga-signoff-YYYY-MM-DD.md`
- Modify: `README.md`

**Step 1: 按门禁逐条打勾（FAIL -> PASS）**

每条门禁必须附“命令输出、测试报告或日志样例”三类证据之一。

**Step 2: 运行总验证**

Run: `npm run lint`  
Run: `npm run typecheck`  
Run: `npm exec -- vitest run`  
Run: `npm run test:e2e`  
Run: `npm run test:perf`  
Run: `npm run package:vsix`  
Expected: ALL PASS

**Step 3: 生成 GA 签署文档**

创建 `ga-signoff-YYYY-MM-DD.md`，记录：版本、门禁证据索引、已知风险（应为 0 阻塞）、签署人。

**Step 4: 冻结 README 发布说明**

README 更新为“稳定发布版”口径，并链接 GA signoff 文档。

---

## 执行顺序与里程碑

1. **M1 质量可证**：Task 1-2 完成（门禁框架 + 真实 E2E）。
2. **M2 体验完备**：Task 3-4 完成（协议补齐 + 可观测性）。
3. **M3 可靠可控**：Task 5-6 完成（安全 + 性能）。
4. **M4 可发布可回滚**：Task 7 完成（发布流水线）。
5. **M5 Perfect GA**：Task 8 完成并签署。

## 每阶段统一完成条件

1. 对应测试命令全部通过，且失败场景测试可复现。
2. 无 `TODO/FIXME` 遗留（代码与文档均适用）。
3. `perfection-gates.md` 对应项由 `FAIL` 变 `PASS` 且证据可追溯。
4. 对外文档（README/CHANGELOG/Release Playbook）完成同步。

## 风险与前置约束

1. `@vscode/test-electron` 首次下载耗时与环境波动高，应在 Task 2 最优先闭环。
2. 性能基线受机器影响大，必须固定采样环境后再启用硬阈值。
3. 发布流程依赖 CI 凭据与 Marketplace 权限，Task 7 前需准备完成。

## Perfect 阶段退出标准（全部满足才可宣告完成）

1. 产品、质量、工程、发布、运维五类门禁全部 `PASS`。
2. 在干净环境可一键复现完整验证链路。
3. 新成员仅依赖仓库文档可独立完成开发、发布与回滚。
