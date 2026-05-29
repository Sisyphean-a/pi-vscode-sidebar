import { parseHostMessage, type HostToUiMessage } from "../../protocol.ts";
import type { CommandPalette } from "../features/command/palette.ts";
import type { CommandUiController } from "../features/command/ui.ts";
import type { ComposerActions } from "../features/composer/actions.ts";

interface AppEventBindingsOptions {
  composerInput: ComposerInputEventPort;
  commandPalette: Pick<CommandPalette, "update">;
  commandUi: Pick<CommandUiController, "clearResult" | "handleKeydown">;
  composerActions: ComposerActions;
  getIsStreamingPhase(): boolean;
  handleHostMessage(message: HostToUiMessage): void;
  handleMessageFeedClick(event: MouseEvent): void;
  handleMessageFeedScroll(): void;
  handlePromptPaste(event: ClipboardEvent | Event): Promise<void>;
  handleScrollToBottom(): void;
  messageFeed: MessageFeedEventPort;
  newSessionButton: ClickEventPort;
  onAbort(): void;
  onNewSession(): void;
  scrollToBottomButton: ClickEventPort;
  sendButton: ClickEventPort;
}

export function bindAppEventBindings(options: AppEventBindingsOptions): void {
  options.sendButton.addClickListener(() => {
    if (options.getIsStreamingPhase()) {
      options.onAbort();
      return;
    }
    options.composerActions.sendPrompt();
  });

  options.composerInput.addInputListener(() => {
    options.composerInput.syncHeight();
    options.commandUi.clearResult();
    options.commandPalette.update(options.composerInput.getValue());
  });

  options.composerInput.addPasteListener((event) => {
    void options.handlePromptPaste(event);
  });

  options.messageFeed.addClickListener((event) => {
    options.handleMessageFeedClick(event);
  });

  options.messageFeed.addScrollListener(() => {
    options.handleMessageFeedScroll();
  });

  options.scrollToBottomButton.addClickListener(() => {
    options.handleScrollToBottom();
  });

  options.composerInput.addKeydownListener((event) => {
    if (event.isComposing || event.key === "Process") return;
    if (options.commandUi.handleKeydown(event)) return;
    if (options.composerActions.handleCommandPaletteKeydown(event)) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (options.composerActions.shouldSubmitCommand(options.composerInput.getValue())) {
      options.composerActions.submitCommand();
      return;
    }
    options.composerActions.sendPrompt();
  });

  options.newSessionButton.addClickListener(() => {
    options.onNewSession();
  });

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = parseHostMessage(event.data);
    if (!message) return;
    options.handleHostMessage(message);
  });
}

interface ClickEventPort {
  addClickListener(listener: () => void): void;
}

interface ComposerInputEventPort {
  addInputListener(listener: () => void): void;
  addKeydownListener(listener: (event: KeyboardEvent) => void): void;
  addPasteListener(listener: (event: ClipboardEvent | Event) => void): void;
  getValue(): string;
  syncHeight(): void;
}

interface MessageFeedEventPort {
  addClickListener(listener: (event: MouseEvent) => void): void;
  addScrollListener(listener: () => void): void;
}
