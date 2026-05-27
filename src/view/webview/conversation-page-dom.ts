interface ScrollConversationFeedToBottomOptions {
  force: boolean;
  messageFeed: HTMLElement;
  shouldScroll: boolean;
  updateScrollToBottomButton(): void;
}

export function handleConversationPageFeedClick(
  _event: MouseEvent,
  target: EventTarget | null,
  onOpenFileReference: (path: string, startLine: number, endLine?: number) => void,
): void {
  if (!(target instanceof Element)) return;
  const reference = target.closest(".file-reference-chip");
  if (!(reference instanceof HTMLButtonElement)) return;
  const path = reference.dataset.path;
  const startLine = Number(reference.dataset.startLine);
  const endLine = reference.dataset.endLine ? Number(reference.dataset.endLine) : undefined;
  if (!path || !Number.isFinite(startLine)) return;
  onOpenFileReference(path, startLine, endLine);
}

export function scrollConversationFeedToBottom(
  options: ScrollConversationFeedToBottomOptions,
): void {
  if (!options.shouldScroll) {
    options.updateScrollToBottomButton();
    return;
  }
  options.messageFeed.scrollTop = options.messageFeed.scrollHeight;
  options.updateScrollToBottomButton();
}

export function hasConversationContent(
  messageFeed: HTMLElement,
  extensionUiPanel: HTMLElement,
): boolean {
  return messageFeed.childElementCount > 0 || !extensionUiPanel.classList.contains("hidden");
}

export function isNearBottom(messageFeed: HTMLElement): boolean {
  return messageFeed.scrollHeight - messageFeed.scrollTop - messageFeed.clientHeight <= 16;
}
