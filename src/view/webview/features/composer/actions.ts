import type { CommandPalette } from "../command/palette.ts";
import type { ImageAttachmentController } from "../image-attachments/controller.ts";

interface CreateComposerActionsOptions {
  composerInput: ComposerInput;
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
  resolveCommandName(rawInput: string): string | undefined;
}

interface ComposerInput {
  getValue(): string;
  resetHeight(): void;
  setValue(value: string): void;
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
        options.commandPalette.applySelection(options.composerInput.getValue());
        return true;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (options.commandPalette.applySelection(options.composerInput.getValue())) {
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
      const text = options.composerInput.getValue().trim();
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
      options.composerInput.setValue("");
      options.imageAttachmentController.clear();
      options.composerInput.resetHeight();
      options.commandPalette.hide();
    },
    shouldSubmitCommand(value) {
      return !!options.resolveCommandName(value);
    },
    submitCommand() {
      const rawInput = options.composerInput.getValue().trim();
      const name = options.resolveCommandName(rawInput);
      if (!name) return;
      options.onPostRunCommand(name, rawInput);
      options.composerInput.setValue("");
      options.composerInput.resetHeight();
      options.commandPalette.hide();
    },
  };
}
