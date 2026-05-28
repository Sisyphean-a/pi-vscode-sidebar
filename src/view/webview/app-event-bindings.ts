import { parseHostMessage, type HostToUiMessage } from "../protocol.ts";
import type { CommandPalette } from "./command-palette.ts";
import type { CommandUiController } from "./command-ui.ts";
import type { ComposerActions } from "./composer-actions.ts";

interface AppEventBindingsOptions {
  commandPalette: Pick<CommandPalette, "update">;
  commandUi: Pick<CommandUiController, "clearResult" | "handleKeydown">;
  composerActions: ComposerActions;
  getIsStreamingPhase(): boolean;
  handleHostMessage(message: HostToUiMessage): void;
  handleMessageFeedClick(event: MouseEvent): void;
  handleMessageFeedScroll(): void;
  handlePromptPaste(event: ClipboardEvent | Event): Promise<void>;
  handleScrollToBottom(): void;
  messageFeed: HTMLElement;
  newSessionButton: HTMLButtonElement;
  onAbort(): void;
  onNewSession(): void;
  promptInput: HTMLTextAreaElement;
  scrollToBottomButton: HTMLButtonElement;
  sendButton: HTMLButtonElement;
  syncComposerHeight(input: HTMLTextAreaElement): void;
}

export function bindAppEventBindings(options: AppEventBindingsOptions): void {
  options.sendButton.addEventListener("click", () => {
    if (options.getIsStreamingPhase()) {
      options.onAbort();
      return;
    }
    options.composerActions.sendPrompt();
  });

  options.promptInput.addEventListener("input", () => {
    options.syncComposerHeight(options.promptInput);
    options.commandUi.clearResult();
    options.commandPalette.update(options.promptInput.value);
  });

  options.promptInput.addEventListener("paste", (event) => {
    void options.handlePromptPaste(event);
  });

  options.messageFeed.addEventListener("click", (event) => {
    options.handleMessageFeedClick(event);
  });

  options.messageFeed.addEventListener("scroll", () => {
    options.handleMessageFeedScroll();
  });

  options.scrollToBottomButton.addEventListener("click", () => {
    options.handleScrollToBottom();
  });

  options.promptInput.addEventListener("keydown", (event) => {
    if (event.isComposing || event.key === "Process") return;
    if (options.commandUi.handleKeydown(event)) return;
    if (options.composerActions.handleCommandPaletteKeydown(event)) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (options.composerActions.shouldSubmitCommand(options.promptInput.value)) {
      options.composerActions.submitCommand();
      return;
    }
    options.composerActions.sendPrompt();
  });

  options.newSessionButton.addEventListener("click", () => {
    options.onNewSession();
  });

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = parseHostMessage(event.data);
    if (!message) return;
    options.handleHostMessage(message);
  });
}
