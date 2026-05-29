import { createRef, type RefObject } from "preact";
import { createPreactRenderPort } from "../ui/preact-render-port.ts";

interface ComposerPickerDom {
  list: HTMLElement;
  panel: HTMLElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
}

interface HeaderDom {
  newSessionButton: HTMLButtonElement;
  recentSessionsOverlay: HTMLElement;
  recentSessionsSection: HTMLElement;
}

interface ConversationDom {
  activityFeed: HTMLElement;
  extensionUiPanel: HTMLElement;
  messageFeed: HTMLElement;
  scrollToBottomButton: HTMLButtonElement;
}

interface ComposerDom {
  commandPalettePanel: HTMLElement;
  commandResult: HTMLElement;
  commandUiPanel: HTMLElement;
  imageAttachmentButton: HTMLButtonElement;
  imageAttachmentList: HTMLElement;
  modelPicker: ComposerPickerDom;
  promptInput: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  thinkingLevelPicker: ComposerPickerDom;
}

interface AppDom {
  composer: ComposerDom;
  conversation: ConversationDom;
  header: HeaderDom;
  root: HTMLElement;
}

export function createAppDom(root: HTMLElement): AppDom {
  const refs = createSidebarAppShellRefs();
  createPreactRenderPort(root).render(<SidebarAppShell refs={refs} />);

  return {
    composer: {
      commandPalettePanel: expectElementRef(refs.commandPalettePanel, "command-palette-panel"),
      commandResult: expectElementRef(refs.commandResult, "command-result"),
      commandUiPanel: expectElementRef(refs.commandUiPanel, "command-ui-panel"),
      imageAttachmentButton: expectButtonRef(refs.imageAttachmentButton, "image-attachment-button"),
      imageAttachmentList: expectElementRef(refs.imageAttachmentList, "image-attachment-list"),
      modelPicker: {
        list: expectElementRef(refs.modelPickerList, "model-picker-list"),
        panel: expectElementRef(refs.modelPickerPanel, "model-picker-panel"),
        root: expectElementRef(refs.modelPickerRoot, "model-picker"),
        trigger: expectButtonRef(refs.modelPickerTrigger, "model-picker-trigger"),
      },
      promptInput: expectTextareaRef(refs.promptInput, "prompt-input"),
      sendButton: expectButtonRef(refs.sendButton, "send-button"),
      thinkingLevelPicker: {
        list: expectElementRef(refs.thinkingLevelPickerList, "thinking-level-picker-list"),
        panel: expectElementRef(refs.thinkingLevelPickerPanel, "thinking-level-picker-panel"),
        root: expectElementRef(refs.thinkingLevelPickerRoot, "thinking-level-picker"),
        trigger: expectButtonRef(refs.thinkingLevelPickerTrigger, "thinking-level-picker-trigger"),
      },
    },
    conversation: {
      activityFeed: expectElementRef(refs.activityFeed, "activity-feed"),
      extensionUiPanel: expectElementRef(refs.extensionUiPanel, "extension-ui-panel"),
      messageFeed: expectElementRef(refs.messageFeed, "message-feed"),
      scrollToBottomButton: expectButtonRef(refs.scrollToBottomButton, "scroll-to-bottom-button"),
    },
    header: {
      newSessionButton: expectButtonRef(refs.newSessionButton, "new-session-button"),
      recentSessionsOverlay: expectElementRef(refs.recentSessionsOverlay, "recent-sessions-overlay"),
      recentSessionsSection: expectElementRef(refs.recentSessionsSection, "recent-sessions-section"),
    },
    root,
  };
}

interface SidebarAppShellRefs {
  activityFeed: RefObject<HTMLDivElement>;
  commandPalettePanel: RefObject<HTMLDivElement>;
  commandResult: RefObject<HTMLDivElement>;
  commandUiPanel: RefObject<HTMLDivElement>;
  extensionUiPanel: RefObject<HTMLElement>;
  imageAttachmentButton: RefObject<HTMLButtonElement>;
  imageAttachmentList: RefObject<HTMLDivElement>;
  messageFeed: RefObject<HTMLDivElement>;
  modelPickerList: RefObject<HTMLDivElement>;
  modelPickerPanel: RefObject<HTMLDivElement>;
  modelPickerRoot: RefObject<HTMLDivElement>;
  modelPickerTrigger: RefObject<HTMLButtonElement>;
  newSessionButton: RefObject<HTMLButtonElement>;
  promptInput: RefObject<HTMLTextAreaElement>;
  recentSessionsOverlay: RefObject<HTMLDivElement>;
  recentSessionsSection: RefObject<HTMLElement>;
  scrollToBottomButton: RefObject<HTMLButtonElement>;
  sendButton: RefObject<HTMLButtonElement>;
  thinkingLevelPickerList: RefObject<HTMLDivElement>;
  thinkingLevelPickerPanel: RefObject<HTMLDivElement>;
  thinkingLevelPickerRoot: RefObject<HTMLDivElement>;
  thinkingLevelPickerTrigger: RefObject<HTMLButtonElement>;
}

function createSidebarAppShellRefs(): SidebarAppShellRefs {
  return {
    activityFeed: createRef<HTMLDivElement>(),
    commandPalettePanel: createRef<HTMLDivElement>(),
    commandResult: createRef<HTMLDivElement>(),
    commandUiPanel: createRef<HTMLDivElement>(),
    extensionUiPanel: createRef<HTMLElement>(),
    imageAttachmentButton: createRef<HTMLButtonElement>(),
    imageAttachmentList: createRef<HTMLDivElement>(),
    messageFeed: createRef<HTMLDivElement>(),
    modelPickerList: createRef<HTMLDivElement>(),
    modelPickerPanel: createRef<HTMLDivElement>(),
    modelPickerRoot: createRef<HTMLDivElement>(),
    modelPickerTrigger: createRef<HTMLButtonElement>(),
    newSessionButton: createRef<HTMLButtonElement>(),
    promptInput: createRef<HTMLTextAreaElement>(),
    recentSessionsOverlay: createRef<HTMLDivElement>(),
    recentSessionsSection: createRef<HTMLElement>(),
    scrollToBottomButton: createRef<HTMLButtonElement>(),
    sendButton: createRef<HTMLButtonElement>(),
    thinkingLevelPickerList: createRef<HTMLDivElement>(),
    thinkingLevelPickerPanel: createRef<HTMLDivElement>(),
    thinkingLevelPickerRoot: createRef<HTMLDivElement>(),
    thinkingLevelPickerTrigger: createRef<HTMLButtonElement>(),
  };
}

function expectElementRef<TElement extends HTMLElement>(
  ref: RefObject<TElement>,
  id: string,
): TElement {
  if (!(ref.current instanceof HTMLElement)) {
    throw new Error(`Missing element: ${id}`);
  }
  return ref.current as TElement;
}

function expectButtonRef(ref: RefObject<HTMLButtonElement>, id: string): HTMLButtonElement {
  if (!(ref.current instanceof HTMLButtonElement)) {
    throw new Error(`Missing button element: ${id}`);
  }
  return ref.current;
}

function expectTextareaRef(ref: RefObject<HTMLTextAreaElement>, id: string): HTMLTextAreaElement {
  if (!(ref.current instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing textarea element: ${id}`);
  }
  return ref.current;
}

interface SidebarAppShellProps {
  refs: SidebarAppShellRefs;
}

export function SidebarAppShell(props: SidebarAppShellProps) {
  return (
    <main class="app-shell">
      <header class="topbar">
        <div class="topbar-row">
          <div class="topbar-actions">
            <button
              id="new-session-button"
              ref={props.refs.newSessionButton}
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
          ref={props.refs.recentSessionsSection}
          aria-label="最近任务"
        ></section>
      </header>

      <section class="conversation">
        <div id="activity-feed" ref={props.refs.activityFeed} class="activity-feed"></div>
        <div id="message-feed" ref={props.refs.messageFeed} class="message-feed"></div>
        <button
          id="scroll-to-bottom-button"
          ref={props.refs.scrollToBottomButton}
          type="button"
          class="scroll-to-bottom"
          hidden
          title="回到底部"
        >
          回到底部
        </button>
        <section
          id="extension-ui-panel"
          ref={props.refs.extensionUiPanel}
          class="message-card extension-panel"
          hidden
        ></section>
      </section>

      <footer class="composer">
        <div id="command-palette-panel" ref={props.refs.commandPalettePanel}></div>
        <div id="command-ui-panel" ref={props.refs.commandUiPanel}></div>
        <div
          id="image-attachment-list"
          ref={props.refs.imageAttachmentList}
          class="image-attachment-list"
        ></div>
        <textarea id="prompt-input" ref={props.refs.promptInput} rows={1} placeholder="继续提问"></textarea>
        <div id="command-result" ref={props.refs.commandResult} class="command-result" hidden></div>
        <div class="composer-toolbar">
          <div id="composer-meta" class="composer-meta">
            <button
              id="image-attachment-button"
              ref={props.refs.imageAttachmentButton}
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
            <div id="model-picker" ref={props.refs.modelPickerRoot} class="composer-picker">
              <button
                id="model-picker-trigger"
                ref={props.refs.modelPickerTrigger}
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
              <div
                id="model-picker-panel"
                ref={props.refs.modelPickerPanel}
                class="composer-picker-panel"
                hidden
              >
                <div
                  id="model-picker-list"
                  ref={props.refs.modelPickerList}
                  class="composer-picker-list"
                  role="listbox"
                  aria-label="模型列表"
                ></div>
              </div>
            </div>
            <div
              id="thinking-level-picker"
              ref={props.refs.thinkingLevelPickerRoot}
              class="composer-picker"
            >
              <button
                id="thinking-level-picker-trigger"
                ref={props.refs.thinkingLevelPickerTrigger}
                type="button"
                class="composer-picker-trigger"
                title="切换思考等级"
                aria-haspopup="listbox"
                aria-expanded="false"
                data-value="medium"
              >
                中
              </button>
              <div
                id="thinking-level-picker-panel"
                ref={props.refs.thinkingLevelPickerPanel}
                class="composer-picker-panel"
                hidden
              >
                <div
                  id="thinking-level-picker-list"
                  ref={props.refs.thinkingLevelPickerList}
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
              ref={props.refs.sendButton}
              type="button"
              class="send-action"
              title="发送消息"
              aria-label="发送消息"
              data-mode="send"
            >
              <svg
                class="send-action-icon send-action-icon-send"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <svg
                class="send-action-icon send-action-icon-stop"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2"></rect>
              </svg>
            </button>
          </div>
        </div>
      </footer>

      <div id="recent-sessions-overlay" ref={props.refs.recentSessionsOverlay}></div>
    </main>
  );
}
