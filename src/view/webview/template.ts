export const SIDEBAR_TEMPLATE = `
  <main class="app-shell">
    <header class="topbar">
      <div class="topbar-main">
        <h1 id="title">就绪</h1>
        <span id="status-badge" class="status-badge">空闲</span>
      </div>
      <div class="topbar-actions">
        <button id="new-session-button" type="button" class="text-action" title="新建会话">新对话</button>
        <button id="abort-button" type="button" class="text-action" title="停止生成">停止</button>
        <button id="reconnect-button" type="button" class="text-action hidden" title="重新连接">重连</button>
      </div>
    </header>

    <section class="conversation">
      <article id="system-message" class="message-card">
        <p>侧边栏正在启动...</p>
      </article>
      <div id="event-feed" class="event-feed"></div>
      <section id="extension-ui-panel" class="message-card extension-panel hidden"></section>
    </section>

    <footer class="composer">
      <textarea id="prompt-input" rows="3" placeholder="继续提问"></textarea>

      <div class="composer-toolbar">
        <div class="toolbar-left">
          <button
            id="toggle-control-button"
            type="button"
            class="icon-action"
            aria-expanded="false"
            aria-controls="control-panel"
            title="更多操作"
          >
            +
          </button>
          <span class="mode-chip">本地模式</span>
        </div>

        <div class="toolbar-right">
          <label class="mini-field" for="thinking-level-select">
            <span>思考</span>
            <select id="thinking-level-select">
              <option value="off">关闭</option>
              <option value="minimal">极低</option>
              <option value="low">低</option>
              <option value="medium" selected>中</option>
              <option value="high">高</option>
              <option value="xhigh">超高</option>
            </select>
          </label>
          <button id="send-button" type="button" class="send-action" title="发送消息">发送</button>
        </div>
      </div>

      <section id="control-panel" class="control-panel hidden">
        <div class="control-grid">
          <label class="compact-field" for="model-provider-input">
            <span>提供方</span>
            <input id="model-provider-input" placeholder="输入提供方名称" />
          </label>
          <label class="compact-field" for="model-id-input">
            <span>模型</span>
            <input id="model-id-input" placeholder="输入模型名称" />
          </label>
          <button id="set-model-button" type="button">应用模型</button>

          <label class="compact-field" for="session-name-input">
            <span>会话名</span>
            <input id="session-name-input" placeholder="当前会话" />
          </label>
          <button id="set-session-name-button" type="button">更新会话名</button>
          <button id="session-stats-button" type="button">会话统计</button>

          <label class="compact-field" for="session-switch-input">
            <span>会话路径</span>
            <input id="session-switch-input" placeholder="输入会话文件路径" />
          </label>
          <button id="switch-session-button" type="button">切换会话</button>
          <button id="load-models-button" type="button">可用模型</button>

          <label class="compact-field" for="export-path-input">
            <span>导出路径</span>
            <input id="export-path-input" placeholder="可选输出文件" />
          </label>
          <button id="export-html-button" type="button">导出网页</button>
          <button id="set-thinking-button" type="button">应用思考级别</button>
        </div>
      </section>
    </footer>
  </main>
`;
