# Webview 迁移架构说明（已完成）

## 1. 迁移目标

`src/view/webview` 的目标是从“命令式 DOM + 局部 render/effect 混用”迁移到“Preact 组件渲染主导、状态单向流动、协议边界集中校验”的结构，同时保持 host/bridge/RPC 契约稳定。

## 2. 当前总览

### 2.1 入口与装配

- 对话页入口：`src/view/webview/app/index.ts`
- 日志页入口：`src/view/webview/panel-log-app.tsx`
- 运行时装配：`src/view/webview/app/runtime.ts` -> `createSidebarAppRuntime()`

`createSidebarAppRuntime()` 当前负责：

1. 构建 UI 控制器（command palette/ui、recent sessions、image attachments、model controls、extension UI 等）
2. 绑定 host message 处理器
3. 返回统一 runtime（`appLifecycle/conversationPage/composerActions/...`）

### 2.2 DOM 边界

`AppDom` 已从平铺结构收敛为三组边界（`src/view/webview/app/shell.tsx`）：

- `header`：会话新建、最近会话区域
- `conversation`：消息流、activity、扩展 UI、滚动按钮
- `composer`：输入区、命令面板、附件、模型/思考等级选择器

所有元素通过 `ref` 注入获取，不再使用 `querySelector/getElementById`。

### 2.3 协议与 zod 校验边界

- 顶层消息协议：`src/view/protocol.ts`
- webview host 二级 payload 解码：`src/view/webview/host/message-decoder.ts`
- 会话事件解析：`src/view/webview/features/conversation/page-events.ts`
- 扩展 UI 请求解析：`src/view/webview/features/extension-ui/state.ts`

`message-handler.ts` 现在主要做分发，不再内联大量 `safeParse` 分支。

## 3. 单向状态流

### 3.1 Host -> UI

1. `window.message` -> `parseHostMessage()`
2. `host/message-handler.ts` 分发：
   - `state/event` -> `modelControls`、`conversationPage`
   - `command_ui_request/result` -> command UI
   - `extension_ui_request` -> extension UI 控制器
3. 各 feature 更新本地状态并触发 Preact 渲染

### 3.2 UI -> Host

1. 用户输入/点击 -> `app/event-bindings.ts`
2. 分发到 `composerActions/commandUi/conversationPage/...`
3. 通过 `uiMessagePoster.post()` 发送协议消息到 host

## 4. 功能覆盖状态

当前已保留并通过测试验证：

- 对话消息流与 assistant/activity 插槽
- recent sessions 预览/弹层/选择
- command palette / command UI
- model picker / thinking level picker
- image attachments（选择、移除、粘贴链路）
- extension UI 请求流
- markdown 渲染与文件引用点击
- streaming/send button 状态切换
- panel log 历史回放/清空

## 5. 迁移阶段结果（当前）

已完成：

- 清理 `classList.toggle/add/remove`
- 清理 `querySelector/getElementById`
- 清理散落 DOM 回查路径，改为 ref 注入与分组边界
- 引入 host payload 解码层，集中 zod 校验入口
- `extension-ui` 从多信号拆分收敛为单一 `viewState` 状态源（`request + drafts`）
- `send-button` 图标改为 `shell.tsx` 静态组件树预置，通过 `data-mode` 切换，移除 `app/lifecycle.ts` 内对子容器重复 `render()`
- `model controls` 去除 `renderTickSignal/signal/effect`，改为单一 `viewState` 变量显式驱动 picker 渲染与图片能力同步
- `composer picker` 去除 `signal/effect` 桥接层，改为状态变更后直接派生视图并同步渲染
- `command palette` / `command ui` 去除 `signal/effect` 桥接层，改为单状态刷新渲染
- `app lifecycle` 去除 `signal/effect`，改为普通状态变量驱动 streaming chrome 同步
- `image attachments` 去除 `signal/effect`，改为单状态变量 + 显式 `sync()` 渲染
- `recent sessions` / `activity transcript` / `conversation feed` / `conversation page-flow` 去除 `signal/effect`，改为状态刷新时显式渲染与派生视图同步
- `src/view/webview` 全域 `signal/effect` 桥接已清零（含 `panel-log-app`）
- 在 `runtime-builders` 引入 `composerInput` 运行时适配器，收敛 `promptInput` 的 DOM 读写/聚焦/高度同步调用，减少 `HTMLElement` 在 feature 间直接传递
- 事件绑定职责下沉到 `runtime-builders` 的 `runtime.bindEvents()`，`runtime.ts` 不再直接向绑定层分发大量 DOM 节点
- `runtime-host` 与 `prompt-reference-editor` 改为依赖 `PromptReferenceInput` 抽象端口，不再依赖裸 `HTMLTextAreaElement`
- `app lifecycle` 改为依赖 `resetComposer/syncStreamingChrome` 回调端口，不再直接持有输入框与按钮 DOM
- `conversation page-flow` 增加视图状态去重与滚动状态变更检测，仅在状态变化时同步 UI，减少重复渲染
- `conversation page-flow` 改为依赖 `viewport` 端口（内容计数/滚动判定/滚动到底），移除对消息容器 DOM 的直接读写
- `app event-bindings` 改为依赖输入/消息区/按钮事件端口，不再直接依赖 `HTMLTextAreaElement/HTMLElement` 类型
- `model controls` 增加渲染状态等价判断，状态未变化时跳过 picker 渲染，减少无效子容器 `render()`
- `command palette` / `command ui` / `recent sessions` / `conversation feed` / `extension-ui` / `image-attachments` 增加视图等价判断，状态未变化时跳过渲染
- 新增 `view-ports` 适配层，`runtime-builders` 改为依赖 `RuntimeViewPorts`，`runtime.ts` 仅负责 `createRuntimeViewPorts(root) -> createSidebarAppRuntime`
- 新增 `ui/preact-render-port.ts`，`command palette` / `command ui` / `image attachments` 改为依赖渲染端口而非直接 `HTMLElement`
- `command ui` 结果展示新增 `CommandUiResultPort` 边界，业务控制器不再直接操作结果 DOM 节点
- `extension-ui` / `recent-sessions` / `conversation feed` / `activity transcript` 已切换到渲染端口，feature 状态层不再依赖容器 `HTMLElement`
- `activity controller` 改为依赖渲染端口解析（含 inline activity slot 动态切换），削减 `container/resolveContainer` DOM 接口
- `view-ports` 新增 `sendButtonStreaming` / `newSessionButtonDisabled` / `scrollToBottomVisibility` 按钮端口，`runtime-builders` 不再直接操作这些 DOM 属性
- `model controls` 改为通过 `createPickerControls` 注入 picker 构造，不再接收裸 `modelPicker/thinkingPicker` DOM 元素结构
- `composer picker` 选项列表改为 `optionListView` 渲染端口，picker 内部不再直接持有列表容器渲染实现
- `panel-log-app` 入口渲染切换为 `PreactRenderPort`，`src/view/webview` 中仅 `shell` 与渲染端口实现自身保留 `preact render` 直接导入
- `view-ports` 进一步上收 `command/extension/recent/conversation/activity/image` 容器渲染端口，`runtime-builders` 不再逐处手工创建 `PreactRenderPort`
- `conversation feed` 对外新增 inline activity slot 的视图端口读取（`findInlineActivitySlotView`），活动流不再传播 slot 的裸 `HTMLElement`
- `conversation feed` 已删除旧 DOM 方法 `ensureInlineActivitySlot/findInlineActivitySlot`，只保留视图端口导向 API
- `view-ports` 新增 `modelPickerControlsFactory`，`runtime-builders` 不再消费 `modelPickerElements/thinkingLevelPickerElements` 原始 DOM 结构
- `image attachments` 改为按钮端口（点击/禁用）注入，feature 内不再依赖 `HTMLButtonElement` 读写
- `view-ports` 统一提供 `commandResult` 与 `extensionUiPanelVisibility` 端口，`runtime-builders` 已移除对这两处裸 DOM 节点的适配代码
- `app/shell` 根渲染也已走 `PreactRenderPort`，`src/view/webview` 仅 `ui/preact-render-port.ts` 保留 `preact render` 直接导入
- `runtime.ts` 不再中转 `AppDom`；`createRuntimeViewPorts(root)` 内部完成 shell 渲染与端口构建，`AppDom` 仅在 shell/view-ports 边界内存在

收敛结论：

- `src/view/webview` 已以 Preact 组件渲染与端口化状态流为主，命令式 DOM 反模式与 signals/effect 混用已清零

## 6. 验证基线

每阶段都以以下命令作为硬门禁：

- `npm run typecheck`
- `npm test`
- `npm run build`
