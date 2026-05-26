export const SIDEBAR_TEMPLATE = `
  <main class="app-shell">
    <header class="topbar">
      <div class="topbar-row">
        <div class="topbar-actions">
          <button id="new-session-button" type="button" class="icon-action topbar-icon-button" title="新建会话" aria-label="新建会话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
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
          <button
            id="send-button"
            type="button"
            class="send-action"
            title="发送消息"
            aria-label="发送消息"
            data-mode="send"
          ></button>
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
