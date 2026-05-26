# Pi 侧边栏输入框命令系统设计

- 日期：2026-05-26
- 状态：已评审通过，待用户审阅文档
- 适用仓库：
  - `E:\github\pi-vscode-sidebar`
  - `E:\github\pi`（仅 `/tree` 需要新增 RPC 能力时）

## 1. 背景

当前 Pi 侧边栏只把输入框内容作为普通 prompt 发送给 Pi RPC，会话命令能力主要仍停留在终端交互层。结果是：

- 用户可以在终端使用 `/resume`、`/tree`、`/compact` 等命令
- 侧边栏输入框无法直接发现或执行这些命令
- 现有侧边栏只接入了少量独立按钮和查询命令，没有统一命令入口

本设计的目标不是照搬终端 TUI，而是在侧边栏输入框中提供一套更适合窄栏场景的命令体验。

## 2. 用户体验约束

本功能必须遵守以下交互约束：

- 入口在输入框内，输入 `/` 即自动弹出极简命令列表
- UI 必须间接、轻量，不占用主消息区
- 默认不展示解释性文案，不做帮助中心式面板
- 能静默成功的命令保持静默
- 只有必须可见的状态才显示短反馈
- 错误必须显式暴露，不做静默降级或伪成功

## 3. 目标与非目标

### 3.1 目标

- 让用户在侧边栏输入框中直接发现并执行常用命令
- 将命令发现、命令执行、命令专用 UI 三层解耦
- 优先复用 Pi RPC 已有能力，减少未来跟随 Pi 升级的维护成本
- 对必须重做交互的命令，提供侧边栏专用极简 UI

### 3.2 非目标

- 不追求首版覆盖终端全部命令
- 不复制终端 `interactive-mode.ts` 的整段命令判断逻辑
- 不把命令结果伪装成聊天消息
- 不引入大面积说明文案、空状态教育文案、帮助页

## 4. 方案选择

本次设计比较了三种方案：

### 方案 A：前端直接解析并执行所有命令

- 优点：接入快，输入框弹层控制最直接
- 缺点：命令判断、参数解析、执行全部散落在 webview，后续最容易和 Pi 脱节

### 方案 B：前端负责发现，Host 负责解释和调度

- 优点：UI 与执行解耦，协议边界清晰，未来跟随 Pi 升级时改动集中
- 缺点：需要新增命令注册表、命令消息协议和命令状态回流

### 方案 C：把 `/xxx` 原样交给 Pi 处理

- 优点：看起来最省适配层
- 缺点：不可行。Pi 现有大量内建命令是 `interactive-mode.ts` 私有逻辑，不是稳定 RPC 接口，尤其 `/tree`、`/resume` 依赖 TUI 选择器

### 结论

采用方案 B。

## 5. 总体架构

命令系统拆成三层：

1. `webview` 命令发现层
2. `host` 命令注册与调度层
3. Pi RPC / 侧边栏专用命令 UI 执行层

### 5.1 Webview 职责

- 监听输入框内容
- 当首字符为 `/` 时展示命令浮层
- 对命令名称做前缀过滤或轻量模糊匹配
- 处理键盘交互：`Up`、`Down`、`Enter`、`Tab`、`Esc`
- 将最终命令提交为结构化消息，不直接执行业务逻辑

### 5.2 Host 职责

- 持有唯一命令注册表
- 解析命令名与参数
- 将命令路由到三种执行器：
  - `rpc-direct`
  - `ui-adapted`
  - `local`
- 负责失败处理、刷新回流、命令 UI 请求下发

### 5.3 执行层职责

- `rpc-direct`：直接映射到 Pi RPC
- `ui-adapted`：先请求侧边栏专用选择器或输入层，再执行底层动作
- `local`：仅在扩展侧可完成的动作，例如扫描本地 recent sessions

## 6. 命令分类

命令注册表中的每条命令至少包含以下元数据：

- `name`
- `kind`
- `argumentMode`
- `execute`
- `matches`
- `visible`

按执行方式分为三类：

### 6.1 `rpc-direct`

底层已有 Pi RPC 支持，侧边栏只做参数适配和状态刷新。

首批纳入：

- `/new`
- `/compact`
- `/clone`
- `/name <text>`
- `/export [path]`

### 6.2 `ui-adapted`

底层动作存在，但终端版交互不适合直接照搬，需要侧边栏重做极简 UI。

首批纳入：

- `/resume`
- `/model`
- `/fork`
- `/tree`

### 6.3 `local`

由扩展侧直接处理，不依赖新增 Pi 对话消息。

首批纳入：

- `/copy`

说明：

- `/copy` 可通过 Pi 现有 RPC `get_last_assistant_text` 实现，因此它也可以视为 `rpc-direct` 的特殊情况；本设计仍将其归入本地命令处理分支，因为它的最终效果是本地剪贴板操作，而不是会话状态变更

## 7. 交互设计

### 7.1 命令浮层

- 输入框首字符为 `/` 时自动弹出
- 浮层锚定在输入框上方
- 不占主消息区，不推动布局，不新增常驻说明区
- 默认只显示命令名列表
- 不显示分类标题
- 不显示大段说明文字
- 当前选中项只允许显示一条极短参数提示，例如 `name`、`path`

### 7.2 键盘行为

- `Up` / `Down`：切换命令项
- `Enter`：
  - 若当前仅输入命令名前缀，则补全或执行当前选中项
  - 若命令参数已满足，则直接提交
- `Tab`：补全当前命令名
- `Esc`：收起浮层，保留输入内容

### 7.3 成功与失败反馈

- 成功默认静默
- 若命令结果本身会刷新界面，则不再追加反馈
- 仅对结果不可见的命令显示短反馈：
  - `/copy`
  - `/export`
- 失败时在输入框附近显示短错误
- 失败后保留原始输入内容，方便立即修改重试
- 命令执行中只显示最小忙碌态，不显示解释性说明

## 8. 专用命令 UI

现有 `extension_ui_request` 面板偏重，不适合作为命令系统主交互层。命令系统新增专用消息通道：

- `command_ui_request`
- `command_ui_response`

其目的不是复用一套大而全弹窗，而是服务输入框附近的极简命令交互。

首批支持四种载荷：

1. `session_list`
2. `session_tree`
3. `message_list`
4. `text_input`

### 8.1 `/resume`

- 触发后打开极简会话列表
- 数据来源优先复用扩展现有 recent sessions provider
- 选择后发送 `switch_session`
- 成功后刷新消息流和最近会话状态

### 8.2 `/model`

- 触发后打开极简模型列表
- 复用现有模型拉取逻辑
- 选择后发送 `set_model`
- 切换成功后仅更新顶部模型状态，不追加聊天消息

### 8.3 `/fork`

- 触发后拉取可分叉的用户消息列表
- 数据来源使用 Pi 已有 RPC：`get_fork_messages`
- 选择后发送 `fork`
- 成功后刷新消息流并切换到新分支状态

### 8.4 `/tree`

- 触发后打开会话树极简选择器
- 选择目标节点后执行树导航
- 导航成功后重绘当前消息流
- 不引入终端版“是否总结分支”的多轮冗长交互

## 9. `/tree` 的实现边界

`/tree` 是本设计中唯一明确需要跨仓协作的命令。

原因：

- Pi 终端版 `/tree` 依赖 `sessionManager.getTree()` 与 `session.navigateTree()`
- 这些能力当前没有暴露到 Pi RPC
- 侧边栏现有 `RpcCommand` 也没有对应协议

因此 `/tree` 的完整实现需要在 `E:\github\pi` 新增 RPC 能力，建议新增：

- `get_session_tree`
- `navigate_session_tree`

对应返回值建议最小化，只暴露侧边栏渲染所需字段：

- `entryId`
- `parentEntryId`
- `label`
- `previewText`
- `isActive`
- `depth`
- `hasChildren`

导航命令最小输入建议为：

- `entryId`

导航命令最小输出建议为：

- `cancelled`
- `editorText?`

若不对 Pi RPC 增强，则 `/tree` 只能通过读取会话文件并重建内部树结构来做只读展示，但仍无法正确完成“跳转到树节点”这一动作，因此本设计不接受这种半功能回退。

## 10. 协议设计

### 10.1 Webview -> Host

在 `src/view/protocol.ts` 中新增：

- `run_command`

建议结构：

```ts
{ type: "run_command"; name: string; rawInput: string; args?: Record<string, unknown> }
```

### 10.2 Host -> Webview

新增：

- `command_ui_request`
- `command_result`

其中：

- `command_ui_request` 仅用于命令专用极简选择器或输入层
- `command_result` 仅用于短成功反馈、短失败反馈、关闭忙碌态

普通聊天消息流继续沿用现有状态与事件消息，不混入命令 UI 数据。

## 11. 推荐文件职责

### `E:\github\pi-vscode-sidebar`

- `src/view/protocol.ts`
  - 增加命令协议类型
- `src/shared/rpc-types.ts`
  - 扩展当前侧边栏可识别的 Pi RPC 命令
- `src/host/controller.ts`
  - 接入 `run_command`
  - 调用命令注册表和执行器
- `src/host/commands/registry.ts`
  - 命令注册表
- `src/host/commands/parser.ts`
  - 参数解析
- `src/host/commands/executors/*.ts`
  - 分类执行器
- `src/view/webview/command-palette.ts`
  - 输入框命令浮层
- `src/view/webview/command-ui.ts`
  - 命令专用极简选择器
- `src/view/webview/app.ts`
  - 连接输入框、浮层、命令消息和命令结果回流

### `E:\github\pi`

- `packages/coding-agent/src/modes/rpc/rpc-types.ts`
  - 新增 `/tree` 所需 RPC 类型
- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
  - 新增树查询与导航命令处理

## 12. 首批命令范围

首批必须形成可用闭环：

- `/new`
- `/resume`
- `/tree`
- `/compact`
- `/model`
- `/fork`
- `/clone`
- `/name`
- `/export`
- `/copy`

暂不进入首批：

- `/settings`
- `/hotkeys`
- `/changelog`
- `/login`
- `/logout`
- `/share`
- `/import`
- `/reload`
- `/quit`

原因：

- 不属于高频会话流命令
- 或需要额外跨层适配，但不能显著提升输入框命令闭环

## 13. 实施顺序

为降低风险，按以下顺序实现：

1. 侧边栏命令协议与命令注册表
2. 输入框命令浮层
3. `rpc-direct` 命令闭环
4. `/resume`、`/model`、`/fork` 的专用命令 UI
5. Pi RPC 扩展 `/tree`
6. 侧边栏 `/tree` 选择器
7. 回归测试与交互收敛

## 14. 测试策略

测试分三层：

### 14.1 Unit

- 命令解析
- 注册表查询
- 命令过滤
- 键盘导航
- 失败后输入保留

### 14.2 Integration

- `run_command -> host -> rpc/query/ui refresh`
- `/resume`
- `/compact`
- `/model`
- `/fork`
- `/copy`

### 14.3 Cross-repo verification

- `/tree` 的 Pi RPC 新协议
- `/tree` 的侧边栏树导航闭环

明确不做：

- 低价值文案快照测试
- 装饰性 DOM 结构快照
- 每个命令一整套重复样板测试

## 15. 兼容与维护策略

- 侧边栏维护自己的 `sidebar command registry`
- 命令注册表只描述侧边栏命令入口，不复制 Pi 终端的执行代码
- `rpc-direct` 优先依赖 Pi 的稳定 RPC 面
- `ui-adapted` 只依赖底层数据与动作，不依赖 TUI 组件本身
- 若 Pi 新增 RPC 命令，通常只需补映射和测试
- 若 Pi 变更 RPC 协议，侧边栏必须在类型层和运行时显式失败，不做静默兼容
- 若 Pi 仅变更 TUI 展现，侧边栏不自动跟随

## 16. 风险

### 风险 1：`/tree` 超出单仓修改范围

- 影响：无法在不改 Pi RPC 的前提下完整实现
- 应对：将 `/tree` 明确定义为跨仓子任务，不接受只读树假实现

### 风险 2：命令 UI 与现有通用扩展 UI 混用导致复杂度上升

- 影响：UI 代码分支增多，状态混乱
- 应对：命令 UI 独立协议、独立渲染器、独立状态回流

### 风险 3：前端承担过多命令业务

- 影响：未来 Pi 升级时同步成本高
- 应对：命令解释和调度留在 host

## 17. 最终结论

本功能采用“输入框极简命令浮层 + Host 命令总线 + Pi RPC 优先复用 + 必要时侧边栏专用 UI 适配”的方案。

其中：

- 侧边栏不是纯调用点，但可以通过分层设计把维护成本压到最低
- `/resume`、`/model`、`/fork` 可在侧边栏仓内闭环
- `/tree` 需要同步扩展 `E:\github\pi` 的 RPC 能力

只要坚持上述边界，本功能可以在不复制终端整套实现的前提下，把高频命令稳定迁移到侧边栏输入流中。
