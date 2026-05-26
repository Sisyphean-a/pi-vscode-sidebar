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
      <div id="command-palette-panel" class="command-palette-panel hidden">
        <div id="command-palette-list" class="command-palette-list"></div>
      </div>
      <div id="command-ui-panel" class="command-ui-panel hidden">
        <div id="command-ui-list" class="command-ui-list"></div>
      </div>
      <textarea id="prompt-input" rows="1" placeholder="继续提问"></textarea>
      <div id="command-result" class="command-result hidden"></div>
      <div class="composer-toolbar">
        <div id="composer-meta" class="composer-meta">
          <div id="model-picker" class="composer-picker">
            <button
              id="model-picker-trigger"
              type="button"
              class="composer-picker-trigger"
              title="切换模型"
              aria-haspopup="listbox"
              aria-expanded="false"
              data-value=""
              disabled
            >
              加载中
            </button>
            <div id="model-picker-panel" class="composer-picker-panel hidden">
              <div id="model-picker-list" class="composer-picker-list" role="listbox" aria-label="模型列表"></div>
            </div>
          </div>
          <div id="thinking-level-picker" class="composer-picker">
            <button
              id="thinking-level-picker-trigger"
              type="button"
              class="composer-picker-trigger"
              title="切换思考等级"
              aria-haspopup="listbox"
              aria-expanded="false"
              data-value="medium"
            >
              中
            </button>
            <div id="thinking-level-picker-panel" class="composer-picker-panel hidden">
              <div
                id="thinking-level-picker-list"
                class="composer-picker-list"
                role="listbox"
                aria-label="思考等级列表"
              ></div>
            </div>
          </div>
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
