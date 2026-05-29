import { resetComposerHeight, syncComposerHeight } from "../features/composer/composer.ts";
import {
  createModelPickerControls,
  type ModelPickerControls,
} from "../features/model/picker-ui.ts";
import { createPreactRenderPort, type PreactRenderPort } from "../ui/preact-render-port.ts";
import type { CommandResult } from "../../protocol.ts";
import { createAppDom } from "./shell.tsx";

export interface RuntimeViewPorts {
  composer: {
    commandPaletteView: PreactRenderPort;
    commandResult: CommandResultPort;
    commandUiView: PreactRenderPort;
    imageAttachmentButton: ButtonControlPort;
    imageAttachmentListView: PreactRenderPort;
    input: ComposerInputRuntime;
    modelPickerControlsFactory: ModelPickerControlsFactoryPort;
    sendButtonClick: ClickEventPort;
    sendButtonStreaming: SendButtonStreamingPort;
  };
  conversation: {
    activityFeedView: PreactRenderPort;
    extensionUiPanelVisibility: HiddenPort;
    extensionUiPanelView: PreactRenderPort;
    eventPort: MessageFeedEventPort;
    messageFeedView: PreactRenderPort;
    scrollToBottomButtonClick: ClickEventPort;
    scrollToBottomVisibility: HiddenPort;
    viewport: ConversationViewport;
  };
  header: {
    newSessionButtonClick: ClickEventPort;
    newSessionButtonDisabled: DisabledPort;
    recentSessionsOverlayView: PreactRenderPort;
    recentSessionsSectionView: PreactRenderPort;
  };
}

export interface ClickEventPort {
  addClickListener(listener: () => void): void;
}

export interface ButtonControlPort extends ClickEventPort, DisabledPort {}

export interface DisabledPort {
  setDisabled(disabled: boolean): void;
}

export interface HiddenPort {
  setHidden(hidden: boolean): void;
}

export interface SendButtonStreamingPort {
  setStreaming(isStreamingPhase: boolean): void;
}

export interface ModelPickerControlsFactoryPort {
  create(handlers: {
    onModelChange(value: string): void;
    onThinkingLevelChange(value: string): void;
  }): ModelPickerControls;
}

export interface CommandResultPort {
  clear(): void;
  show(result: CommandResult): void;
}

export interface ComposerInputEventPort {
  addInputListener(listener: () => void): void;
  addKeydownListener(listener: (event: KeyboardEvent) => void): void;
  addPasteListener(listener: (event: ClipboardEvent | Event) => void): void;
  getValue(): string;
  syncHeight(): void;
}

export interface ComposerInputRuntime extends ComposerInputEventPort {
  focus(): void;
  getSelectionEnd(): number | null;
  getSelectionStart(): number | null;
  resetHeight(): void;
  setSelection(start: number, end: number): void;
  setValue(value: string): void;
  setValueAndSyncHeight(value: string): void;
}

export interface ConversationViewport {
  getChildElementCount(): number;
  isNearBottom(): boolean;
  scrollToBottom(): void;
}

export interface MessageFeedEventPort {
  addClickListener(listener: (event: MouseEvent) => void): void;
  addScrollListener(listener: () => void): void;
}

export function createRuntimeViewPorts(root: HTMLElement): RuntimeViewPorts {
  const dom = createAppDom(root);
  const composer = dom.composer;
  const conversation = dom.conversation;
  const header = dom.header;
  const input = createComposerInputRuntime(composer.promptInput);
  const messageFeed = conversation.messageFeed;
  return {
    composer: {
      commandPaletteView: createPreactRenderPort(composer.commandPalettePanel),
      commandResult: createCommandResultPort(composer.commandResult),
      commandUiView: createPreactRenderPort(composer.commandUiPanel),
      imageAttachmentButton: createButtonControlPort(composer.imageAttachmentButton),
      imageAttachmentListView: createPreactRenderPort(composer.imageAttachmentList),
      input,
      modelPickerControlsFactory: createModelPickerControlsFactory(
        composer.modelPicker,
        composer.thinkingLevelPicker,
      ),
      sendButtonClick: createClickEventPort(composer.sendButton),
      sendButtonStreaming: createSendButtonStreamingPort(composer.sendButton),
    },
    conversation: {
      activityFeedView: createPreactRenderPort(conversation.activityFeed),
      extensionUiPanelVisibility: createHiddenPort(conversation.extensionUiPanel),
      extensionUiPanelView: createPreactRenderPort(conversation.extensionUiPanel),
      eventPort: createMessageFeedEventPort(messageFeed),
      messageFeedView: createPreactRenderPort(messageFeed),
      scrollToBottomButtonClick: createClickEventPort(conversation.scrollToBottomButton),
      scrollToBottomVisibility: createHiddenPort(conversation.scrollToBottomButton),
      viewport: createConversationViewport(messageFeed),
    },
    header: {
      newSessionButtonClick: createClickEventPort(header.newSessionButton),
      newSessionButtonDisabled: createDisabledPort(header.newSessionButton),
      recentSessionsOverlayView: createPreactRenderPort(header.recentSessionsOverlay),
      recentSessionsSectionView: createPreactRenderPort(header.recentSessionsSection),
    },
  };
}

function createClickEventPort(element: HTMLButtonElement): ClickEventPort {
  return {
    addClickListener(listener) {
      element.addEventListener("click", listener);
    },
  };
}

function createButtonControlPort(button: HTMLButtonElement): ButtonControlPort {
  return { ...createClickEventPort(button), ...createDisabledPort(button) };
}

function createDisabledPort(button: HTMLButtonElement): DisabledPort {
  return {
    setDisabled(disabled) {
      button.disabled = disabled;
    },
  };
}

function createHiddenPort(element: HTMLElement): HiddenPort {
  return {
    setHidden(hidden) {
      element.hidden = hidden;
    },
  };
}

function createSendButtonStreamingPort(button: HTMLButtonElement): SendButtonStreamingPort {
  return {
    setStreaming(isStreamingPhase) {
      button.dataset.mode = isStreamingPhase ? "stop" : "send";
      button.title = isStreamingPhase ? "停止生成" : "发送消息";
      button.setAttribute("aria-label", button.title);
    },
  };
}

function createCommandResultPort(element: HTMLElement): CommandResultPort {
  return {
    clear() {
      element.textContent = "";
      element.hidden = true;
      delete element.dataset.status;
    },
    show(result) {
      element.textContent = result.message ?? "";
      element.dataset.status = result.status;
      element.hidden = !result.message;
    },
  };
}

function createModelPickerControlsFactory(
  modelPickerElements: {
    list: HTMLElement;
    panel: HTMLElement;
    root: HTMLElement;
    trigger: HTMLButtonElement;
  },
  thinkingLevelPickerElements: {
    list: HTMLElement;
    panel: HTMLElement;
    root: HTMLElement;
    trigger: HTMLButtonElement;
  },
): ModelPickerControlsFactoryPort {
  return {
    create(handlers) {
      return createModelPickerControls({
        modelPicker: modelPickerElements,
        thinkingLevelPicker: thinkingLevelPickerElements,
        onModelChange: handlers.onModelChange,
        onThinkingLevelChange: handlers.onThinkingLevelChange,
      });
    },
  };
}

function createComposerInputRuntime(promptInput: HTMLTextAreaElement): ComposerInputRuntime {
  return {
    addInputListener(listener) {
      promptInput.addEventListener("input", listener);
    },
    addKeydownListener(listener) {
      promptInput.addEventListener("keydown", listener);
    },
    addPasteListener(listener) {
      promptInput.addEventListener("paste", listener);
    },
    focus() {
      promptInput.focus();
    },
    getSelectionEnd() {
      return promptInput.selectionEnd;
    },
    getSelectionStart() {
      return promptInput.selectionStart;
    },
    getValue() {
      return promptInput.value;
    },
    resetHeight() {
      resetComposerHeight(promptInput);
    },
    setSelection(start, end) {
      promptInput.selectionStart = start;
      promptInput.selectionEnd = end;
    },
    setValue(value) {
      promptInput.value = value;
    },
    setValueAndSyncHeight(value) {
      promptInput.value = value;
      syncComposerHeight(promptInput);
    },
    syncHeight() {
      syncComposerHeight(promptInput);
    },
  };
}

function createConversationViewport(messageFeed: HTMLElement): ConversationViewport {
  return {
    getChildElementCount() {
      return messageFeed.childElementCount;
    },
    isNearBottom() {
      return messageFeed.scrollHeight - messageFeed.scrollTop - messageFeed.clientHeight <= 16;
    },
    scrollToBottom() {
      messageFeed.scrollTop = messageFeed.scrollHeight;
    },
  };
}

function createMessageFeedEventPort(messageFeed: HTMLElement): MessageFeedEventPort {
  return {
    addClickListener(listener) {
      messageFeed.addEventListener("click", listener);
    },
    addScrollListener(listener) {
      messageFeed.addEventListener("scroll", listener);
    },
  };
}
