import type { CommandPalette } from "./command-palette.ts";
import type { ImageAttachmentController } from "./image-attachments.ts";

interface CreateComposerActionsOptions {
  commandPalette: CommandPalette;
  imageAttachmentController: ImageAttachmentController;
  onAppendLocalUserPrompt(
    text: string,
    attachments: ReturnType<ImageAttachmentController["getPending"]>,
  ): void;
  onPostRunCommand(name: string, rawInput: string): void;
  onPostSendPrompt(
    text: string,
    images: Array<{ type: string; data: string; mimeType: string }>,
  ): void;
  onUnsupportedImageInput(): void;
  promptInput: HTMLTextAreaElement;
  resetComposerHeight(input: HTMLTextAreaElement): void;
  resolveCommandName(rawInput: string): string | undefined;
}

export interface ComposerActions {
  handleCommandPaletteKeydown(event: KeyboardEvent): boolean;
  sendPrompt(): void;
  shouldSubmitCommand(value: string): boolean;
  submitCommand(): void;
}

export function createComposerActions(options: CreateComposerActionsOptions): ComposerActions {
  return {
    handleCommandPaletteKeydown(event) {
      if (!options.commandPalette.isVisible()) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        return options.commandPalette.moveSelection(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        return options.commandPalette.moveSelection(-1);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        options.commandPalette.applySelection(options.promptInput.value);
        return true;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (options.commandPalette.applySelection(options.promptInput.value)) {
          this.submitCommand();
        }
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        options.commandPalette.hide();
        return true;
      }
      return false;
    },
    sendPrompt() {
      const text = options.promptInput.value.trim();
      const pendingAttachments = options.imageAttachmentController.getPending();
      if (!text && pendingAttachments.length === 0) return;
      if (pendingAttachments.length > 0 && !options.imageAttachmentController.supportsInput()) {
        options.onUnsupportedImageInput();
        return;
      }

      options.onAppendLocalUserPrompt(text, pendingAttachments);
      options.onPostSendPrompt(
        text,
        pendingAttachments.map((attachment) => attachment.image),
      );
      options.promptInput.value = "";
      options.imageAttachmentController.clear();
      options.resetComposerHeight(options.promptInput);
      options.commandPalette.hide();
    },
    shouldSubmitCommand(value) {
      return !!options.resolveCommandName(value);
    },
    submitCommand() {
      const rawInput = options.promptInput.value.trim();
      const name = options.resolveCommandName(rawInput);
      if (!name) return;
      options.onPostRunCommand(name, rawInput);
      options.promptInput.value = "";
      options.resetComposerHeight(options.promptInput);
      options.commandPalette.hide();
    },
  };
}
