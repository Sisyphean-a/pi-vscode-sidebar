# Pi Sidebar Release Playbook

## 1. 发布前检查

1. 本地执行 `npm run release:check` 必须通过。
2. `CHANGELOG.md` 必须包含当前 `package.json` 版本的条目。
3. `docs/quality-gates/perfection-gates.md` 中发布相关门禁需为 `PASS`。

## 2. 打包步骤

1. 执行 `npm run package:vsix`。
2. 产物路径：`dist/pi-vscode-sidebar-<version>.vsix`。
3. 记录产物 hash（SHA256）到发布记录。

## 3. CI/CD 流程

1. PR 合并前：CI 必须通过 `verify + test:e2e + test:perf + build`。
2. Tag 发布：推送 `v<semver>` 标签触发 `release.yml`。
3. Release 任务会执行 `release:check`，然后打包并上传 `.vsix` 资产。

## 4. 回滚预案

1. 触发条件：
   - 安装后出现阻塞级故障（启动失败、核心链路不可用、数据破坏风险）。
2. 回滚动作：
   - 在发布平台撤回有问题版本。
   - 发布上一个稳定版本对应的 `.vsix`（热修复标签优先）。
   - 在 changelog 标注“retracted”并附问题编号。
3. 用户通知：
   - 通过 release note 和项目公告说明受影响版本与升级路径。
4. 兼容策略：
   - 新版本不得破坏既有会话恢复数据结构。
   - 如涉及结构变更，需提供向后兼容读取逻辑并在发布说明标明。

## 5. 责任分工与响应时限

1. 发布负责人：执行发布流程并保留证据。
2. 值班负责人：发布后 24 小时内监控异常反馈。
3. 阻塞故障响应：15 分钟内确认，60 分钟内给出回滚或修复决策。
