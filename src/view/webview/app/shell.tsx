import { render } from "preact";

export interface AppDom {
  activityFeed: HTMLElement;
  commandPaletteList: HTMLElement;
  commandPalettePanel: HTMLElement;
  commandResult: HTMLElement;
  commandUiList: HTMLElement;
  commandUiPanel: HTMLElement;
  extensionUiPanel: HTMLElement;
  imageAttachmentButton: HTMLButtonElement;
  imageAttachmentList: HTMLElement;
  messageFeed: HTMLElement;
  newSessionButton: HTMLButtonElement;
  promptInput: HTMLTextAreaElement;
  recentSessionsDialogClose: HTMLButtonElement;
  recentSessionsDialogList: HTMLElement;
  recentSessionsDialogTitle: HTMLElement;
  recentSessionsMoreButton: HTMLButtonElement;
  recentSessionsOverlay: HTMLElement;
  recentSessionsPreview: HTMLElement;
  recentSessionsSection: HTMLElement;
  root: HTMLElement;
  scrollToBottomButton: HTMLButtonElement;
  sendButton: HTMLButtonElement;
}

export function createAppDom(root: HTMLElement): AppDom {
  render(<SidebarAppShell />, root);

  return {
    activityFeed: expectAppElement(root, "activity-feed"),
    commandPaletteList: expectAppElement(root, "command-palette-list"),
    commandPalettePanel: expectAppElement(root, "command-palette-panel"),
    commandResult: expectAppElement(root, "command-result"),
    commandUiList: expectAppElement(root, "command-ui-list"),
    commandUiPanel: expectAppElement(root, "command-ui-panel"),
    extensionUiPanel: expectAppElement(root, "extension-ui-panel"),
    imageAttachmentButton: expectAppElement(root, "image-attachment-button"),
    imageAttachmentList: expectAppElement(root, "image-attachment-list"),
    messageFeed: expectAppElement(root, "message-feed"),
    newSessionButton: expectAppElement(root, "new-session-button"),
    promptInput: expectAppElement(root, "prompt-input"),
    recentSessionsDialogClose: expectAppElement(root, "recent-sessions-dialog-close"),
    recentSessionsDialogList: expectAppElement(root, "recent-sessions-dialog-list"),
    recentSessionsDialogTitle: expectAppElement(root, "recent-sessions-dialog-title"),
    recentSessionsMoreButton: expectAppElement(root, "recent-sessions-more-button"),
    recentSessionsOverlay: expectAppElement(root, "recent-sessions-overlay"),
    recentSessionsPreview: expectAppElement(root, "recent-sessions-preview"),
    recentSessionsSection: expectAppElement(root, "recent-sessions-section"),
    root,
    scrollToBottomButton: expectAppElement(root, "scroll-to-bottom-button"),
    sendButton: expectAppElement(root, "send-button"),
  };
}

export function expectAppElement<TElement extends HTMLElement>(
  root: ParentNode,
  id: string,
): TElement {
  const element = root.querySelector(`#${id}`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as TElement;
}

export function SidebarAppShell() {
  return (
    <main class="app-shell">
      <header class="topbar">
        <div class="topbar-row">
          <div class="topbar-actions">
            <button
              id="new-session-button"
              type="button"
              class="icon-action topbar-icon-button"
              title="新建会话"
              aria-label="新建会话"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
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
        <div id="activity-feed" class="activity-feed"></div>
        <div id="message-feed" class="message-feed"></div>
        <button
          id="scroll-to-bottom-button"
          type="button"
          class="scroll-to-bottom hidden"
          title="回到底部"
        >
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
        <div id="image-attachment-list" class="image-attachment-list hidden"></div>
        <textarea id="prompt-input" rows={1} placeholder="继续提问"></textarea>
        <div id="command-result" class="command-result hidden"></div>
        <div class="composer-toolbar">
          <div id="composer-meta" class="composer-meta">
            <button
              id="image-attachment-button"
              type="button"
              class="icon-action composer-icon-button"
              title="添加图片"
              aria-label="添加图片"
              disabled
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                <circle cx="9" cy="10" r="1.5"></circle>
                <path d="M21 15l-4.5-4.5L7 20"></path>
              </svg>
            </button>
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
                <div
                  id="model-picker-list"
                  class="composer-picker-list"
                  role="listbox"
                  aria-label="模型列表"
                ></div>
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
            <button
              id="recent-sessions-dialog-close"
              type="button"
              class="icon-action"
              title="关闭"
            >
              关闭
            </button>
          </div>
          <div id="recent-sessions-dialog-list" class="recent-sessions-dialog-list"></div>
        </section>
      </div>
    </main>
  );
}
