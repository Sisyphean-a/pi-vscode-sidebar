export const SIDEBAR_TEMPLATE = `
  <main class="app-shell">
    <header class="topbar">
      <div class="topbar-main">
        <h1 id="title">未连接Pi</h1>
      </div>
      <div class="topbar-actions">
        <button id="new-session-button" type="button" class="text-action" title="新建会话">新对话</button>
        <button id="abort-button" type="button" class="text-action" title="停止生成">停止</button>
        <button id="reconnect-button" type="button" class="text-action hidden" title="重新连接">重连</button>
      </div>
    </header>

    <section class="conversation">
      <div id="message-feed" class="message-feed"></div>
      <button id="scroll-to-bottom-button" type="button" class="scroll-to-bottom hidden" title="回到底部">
        回到底部
      </button>
      <section id="extension-ui-panel" class="message-card extension-panel hidden"></section>
    </section>

    <footer class="composer">
      <textarea id="prompt-input" rows="3" placeholder="继续提问"></textarea>
      <div class="composer-toolbar">
        <div id="composer-meta" class="composer-meta">
          <button id="model-select-button" type="button" class="composer-select-button" title="切换模型">
            <span id="model-select-value">加载中</span>
          </button>
          <button id="thinking-level-button" type="button" class="composer-select-button" title="切换思考等级">
            <span id="thinking-level-value">中</span>
          </button>
        </div>
        <div class="toolbar-right">
          <button id="send-button" type="button" class="send-action" title="发送消息">发送</button>
        </div>
      </div>
      <select id="model-select" class="hidden" disabled>
        <option value="">加载中</option>
      </select>
      <select id="thinking-level-select" class="hidden">
        <option value="off">关闭</option>
        <option value="minimal">极低</option>
        <option value="low">低</option>
        <option value="medium" selected>中</option>
        <option value="high">高</option>
        <option value="xhigh">超高</option>
      </select>
    </footer>
  </main>
`;
