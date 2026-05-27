import { SIDEBAR_TEMPLATE } from "./template.ts";

export interface AppDom {
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
  root.innerHTML = SIDEBAR_TEMPLATE;

  return {
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
