export const SIDEBAR_TEMPLATE = `
  <main class="app-shell">
    <header class="topbar">
      <div class="topbar-row">
        <div class="topbar-main">
          <h1 id="title">未连接Pi</h1>
        </div>
        <div class="topbar-actions">
          <button id="new-session-button" type="button" class="text-action" title="新建会话">新对话</button>
          <button id="abort-button" type="button" class="text-action" title="停止生成">停止</button>
          <button id="reconnect-button" type="button" class="text-action hidden" title="重新连接">重连</button>
        </div>
      </div>
      <section
        id="recent-sessions-section"
        class="recent-sessions recent-sessions-stream hidden"
        aria-label="最近任务"
      >
        <div id="recent-sessions-preview" class="recent-sessions-preview"></div>
        <button
          id="recent-sessions-more-button"
          type="button"
          class="recent-sessions-more recent-sessions-link hidden"
        >
          查看全部
        </button>
      </section>
    </header>

    <section class="conversation">
      <div id="message-feed" class="message-feed"></div>
      <button id="scroll-to-bottom-button" type="button" class="scroll-to-bottom hidden" title="回到底部">
        回到底部
      </button>
      <section id="extension-ui-panel" class="message-card extension-panel hidden"></section>
    </section>

    <footer class="composer">
      <textarea id="prompt-input" rows="1" placeholder="继续提问"></textarea>
      <div class="composer-toolbar">
        <div id="composer-meta" class="composer-meta">
          <select id="model-select" class="composer-select" title="切换模型" disabled>
            <option value="">加载中</option>
          </select>
          <select id="thinking-level-select" class="composer-select" title="切换思考等级">
            <option value="off">关闭</option>
            <option value="minimal">极低</option>
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
            <option value="xhigh">超高</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button id="send-button" type="button" class="send-action" title="发送消息">发送</button>
        </div>
      </div>
    </footer>

    <div id="recent-sessions-overlay" class="recent-sessions-overlay hidden">
      <section
        id="recent-sessions-dialog"
        class="recent-sessions-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recent-sessions-dialog-title"
      >
        <div class="recent-sessions-dialog-header">
          <h2 id="recent-sessions-dialog-title">全部任务</h2>
          <button id="recent-sessions-dialog-close" type="button" class="icon-action" title="关闭">
            关闭
          </button>
        </div>
        <div id="recent-sessions-dialog-list" class="recent-sessions-dialog-list"></div>
      </section>
    </div>
  </main>
`;
