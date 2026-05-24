# Pi VSCode 侧边栏扩展开发文档

## 1. 文档目的

本文档定义从零创建项目到可发布 VSCode 扩展的完整开发流程。目标是“无上下文执行”：新项目只要携带本文件与设计文档，即可按步骤落地。

配套设计文档：`PI_VSCODE_SIDEBAR_DESIGN.md`。

## 2. 交付物范围

首期交付以下模块：

1. 侧边栏主聊天视图（WebviewView）。
2. Pi RPC 进程管理与事件桥接。
3. VSCode 本地 bridge server 与方法集。
4. Pi bridge 扩展脚本注入。
5. 会话持久化与恢复。
6. 完整错误可见性与基础自动化测试。

## 3. 项目初始化

## 3.1 技术栈

- 语言：TypeScript
- 运行：Node 22+
- 打包：rolldown 或 esbuild（二选一，保持简单）
- 测试：Vitest + VSCode extension test

## 3.2 建议目录结构

```text
pi-vscode-sidebar/
  src/
    extension.ts
    host/
      controller.ts
      rpc-client.ts
      process-manager.ts
      state-store.ts
      message-bus.ts
    view/
      provider.ts
      webview/
        index.html
        app.ts
        styles.css
        protocol.ts
    bridge/
      server.ts
      handlers.ts
      serialize.ts
      state.ts
      types.ts
      utils.ts
    pi/
      runtime.ts
      args.ts
      env.ts
      resolve.ts
    session/
      tracker.ts
  bridge/
    pi-vscode-bridge.js
  test/
    unit/
    integration/
  package.json
  tsconfig.json
  README.md
```

说明：

1. `host/` 负责扩展宿主编排逻辑。
2. `view/` 与 `host/` 通过协议通信，不互相直接引用内部状态。
3. `bridge/` 可从 `pi-vscode` 迁移并重命名。

## 4. 分阶段实施

## 阶段 0：脚手架与最小可运行

### 目标

- 扩展激活后出现 Activity Bar 图标和侧边栏视图。

### 任务

1. 初始化 `package.json` 的 `contributes.viewsContainers` 与 `contributes.views`。
2. 注册 `WebviewViewProvider`。
3. 渲染静态 “Pi Sidebar Ready” 页面。

### 验收

- 能在侧边栏看到视图，不依赖 Pi 安装。

## 阶段 1：接入 Pi RPC（只读链路）

### 目标

- UI 可以发送 prompt，看到流式输出。

### 任务

1. 实现 `ProcessManager`：启动/停止 Pi 子进程。
2. 启动参数包含：`--mode rpc`。
3. 实现 JSONL 读写与 command id 关联。
4. 支持命令：`prompt`、`abort`、`get_state`。
5. 处理事件：`agent_start`、`message_update`、`agent_end`、错误响应。

### 验收

- 输入消息后，UI 逐字流式显示。
- `abort` 生效并恢复 idle。

## 阶段 2：状态模型完善

### 目标

- 支持完整会话控制与模型控制。

### 任务

1. 接入：`new_session` `switch_session` `set_session_name` `get_session_stats`。
2. 接入：`get_available_models` `set_model`。
3. 接入：`set_thinking_level`。
4. 实现 Host 侧状态机（idle/streaming/awaiting_extension_ui/process_dead）。

### 验收

- 会话切换、模型切换在 UI 可见且正确。

## 阶段 3：接入 IDE bridge（高价值复用）

### 目标

- Pi 能通过 bridge 工具感知和操作 VSCode。

### 任务

1. 迁移 `pi-vscode` 的 `bridge/server.ts`、`handlers.ts`、`serialize.ts`、`state.ts`。
2. 启动 bridge，生成 token，监听 `127.0.0.1`。
3. 启动 Pi 时注入：
   - `PI_VSCODE_BRIDGE_URL`
   - `PI_VSCODE_BRIDGE_TOKEN`
   - `--extension bridge/pi-vscode-bridge.js`
4. 迁移并裁剪 `bridge/pi-vscode-bridge.js` 工具定义。

### 验收

- Pi 在会话中可调用 `vscode_get_editor_state`、`vscode_get_diagnostics`、`vscode_open_file`、`vscode_apply_workspace_edit` 等工具。

## 阶段 4：Extension UI 交互闭环

### 目标

- `extension_ui_request` 不再被动取消，而是在侧边栏可交互。

### 任务

1. UI 实现 `select/confirm/input/editor` 四类组件。
2. Host 收到请求后转发 UI；UI 提交后回传 `extension_ui_response`。
3. 增加超时与 cancel 通道，防止死锁。

### 验收

- 任一 extension UI 请求都能完成或取消，不挂死会话。

## 阶段 5：会话恢复与发布准备

### 目标

- 关闭重开 VSCode 后恢复历史会话。

### 任务

1. 复用 `sessions.ts` 思路，保存 `terminalId/sessionFile` 或直接保存 `sessionFile` 映射。
2. 激活时校验文件存在并恢复。
3. 实现 `deactivate` 清理子进程与服务端口。

### 验收

- 恢复后可继续提问且上下文完整。

## 5. 关键实现细节

## 5.1 Pi 进程管理

要求：

1. 单视图单活跃 RPC 进程（首期不做多会话并发进程池）。
2. 进程 stderr 必须采集并可查看。
3. 发送命令超时必须报错到 UI。
4. 子进程退出事件必须驱动状态机到 `process_dead`。

建议接口：

```ts
interface PiProcessManager {
  start(options: StartOptions): Promise<void>;
  stop(): Promise<void>;
  send(command: RpcCommand): Promise<RpcResponse>;
  onEvent(listener: (evt: AgentEvent | RpcExtensionUIRequest) => void): () => void;
}
```

## 5.2 Host-State 单向数据流

1. 所有状态更新在 Host 统一发生。
2. UI 不维护“真状态”，只维护渲染态。
3. 每次关键动作后可调用 `get_state` 校准。

## 5.3 Webview 协议与安全

1. UI <-> Host 消息使用 discriminated union。
2. 所有消息先 schema 校验后处理。
3. Webview 注入 `nonce`，CSP 禁止任意脚本。

## 5.4 Bridge 方法裁剪策略

优先保留：

- 只读高频：editor state/selection/diagnostics/symbols/definitions/references。
- 写操作核心：openFile/applyWorkspaceEdit/format/save。

可后置：

- 通知缓冲类增强、包管理功能。

## 6. 借鉴与迁移清单

## 6.1 可直接迁移（低改动）

1. `src/bridge/*` 除命名空间。
2. `bridge/pi-vscode-bridge.js`（按产品命名替换工具前缀可选）。
3. `src/pi.ts` 的 binary resolve + env 注入逻辑。

## 6.2 需改造迁移（中改动）

1. `src/chat.ts`：保留流式解析逻辑，替换输出目标为 Webview。
2. `src/sessions.ts`：从 terminal 生命周期映射改为 sidebar/controller 生命周期映射。

## 6.3 不迁移（冲突）

1. `src/terminal.ts` 新窗口/分栏策略。
2. 以 terminal 作为主交互入口的命令设计。

## 7. 质量门禁

## 7.1 静态检查

每次提交前至少执行：

1. `pnpm lint`
2. `pnpm typecheck`

## 7.2 单元测试（必须）

1. JSONL 分帧/解析。
2. RPC request-response 超时处理。
3. 状态机迁移（idle/streaming/awaiting/process_dead）。
4. bridge handler 参数校验（非法输入报错）。

## 7.3 集成测试（必须）

1. 启动扩展后发送 prompt，收到流式文本。
2. 触发 tool_execution 事件并渲染。
3. 模拟 extension_ui_request 并完成响应。
4. 会话恢复链路。

## 7.4 失败场景验证（必须）

1. Pi 不存在。
2. Pi 子进程启动后立即退出。
3. bridge token 错误。
4. RPC 响应超时。

要求：每个场景 UI 都要显示明确错误文本，且可恢复。

## 8. 数据与配置

## 8.1 建议配置项

- `piSidebar.path`：Pi 二进制绝对路径（可空，自动探测）。
- `piSidebar.rpcTimeoutMs`：RPC 超时。
- `piSidebar.bridgeEnabled`：是否启用 IDE bridge。
- `piSidebar.logLevel`：`error|warn|info|debug`。

## 8.2 workspaceState 键建议

- `piSidebar.sessions`：会话映射。
- `piSidebar.lastModel`：上次模型。
- `piSidebar.viewState`：UI 持久化信息（折叠态等）。

## 9. 发布与兼容

1. 在 README 明确 Node 要求与 Pi 版本范围。
2. 声明“当前仅支持本地 bridge，不支持远程 SSH 环境”。
3. 发布前手工跑一次 smoke：
   - 安装扩展
   - 打开侧边栏
   - 连续 3 轮对话
   - 一次工具调用
   - 一次会话恢复

## 10. 迁移到新项目的操作手册

1. 新建仓库并拷贝本文档与设计文档。
2. 首先实现阶段 0/1，验证 RPC 主链路。
3. 再迁移 bridge 模块，不要先做 UI 花活。
4. 每完成一个阶段，更新 README 的“已实现能力矩阵”。
5. 如需偏离本文档设计，必须在项目内新增 `DECISIONS.md` 记录偏离原因。

## 11. 资料入口（开发时常用）

- Pi RPC 协议源文件：
  - `E:\github\pi\packages\coding-agent\src\modes\rpc\rpc-types.ts`
- Pi RPC 运行逻辑：
  - `E:\github\pi\packages\coding-agent\src\modes\rpc\rpc-mode.ts`
- pi-vscode bridge 参考：
  - `E:\github\pi-vscode\src\bridge\handlers.ts`
  - `E:\github\pi-vscode\bridge\pi-vscode-bridge.js`
- VSCode 官方文档：
  - <https://code.visualstudio.com/api/extension-guides/webview>
  - <https://code.visualstudio.com/api/extension-guides/chat>
  - <https://code.visualstudio.com/api/working-with-extensions/testing-extension>

## 12. 完成定义（最终）

满足以下全部条件才可宣布“完整侧边栏扩展已完成”：

1. 侧边栏可稳定进行多轮流式会话。
2. 工具调用过程与结果可见。
3. Extension UI 请求可交互响应。
4. IDE bridge 核心读写能力可用。
5. 异常路径全部显式报错，可恢复。
6. 自动化测试与手工 smoke 全通过。
