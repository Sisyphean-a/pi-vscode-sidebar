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
      <div id="message-feed" class="message-feed"></div>
      <section id="extension-ui-panel" class="message-card extension-panel hidden"></section>
    </section>

    <footer class="composer">
      <textarea id="prompt-input" rows="3" placeholder="继续提问"></textarea>
      <div class="composer-toolbar">
        <div class="toolbar-left">
          <span class="mode-chip">本地模式</span>
          <span id="model-chip" class="mode-chip">模型：按 Pi 配置</span>
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
    </footer>
  </main>
`;
