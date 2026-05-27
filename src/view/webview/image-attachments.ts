import type { UiPendingImageAttachment } from "../protocol.ts";
import { syncImageAttachmentUi } from "./image-attachments-dom.ts";
import {
  handleImageAttachmentPaste,
  type StorePastedImagePayload,
} from "./image-attachments-paste.ts";
import {
  addImageAttachments,
  clearImageAttachments,
  createImageAttachmentState,
  removeImageAttachment,
  setImageAttachmentSupported,
  type ImageAttachmentState,
} from "./image-attachments-state.ts";

interface ImageAttachmentControllerOptions {
  button: HTMLButtonElement;
  list: HTMLElement;
  onRequestPick(): void;
  onStorePastedImage(payload: StorePastedImagePayload): void;
  onUnsupportedInput(): void;
}

export interface ImageAttachmentController {
  applyAdded(data: { attachments?: UiPendingImageAttachment[] }): void;
  clear(): void;
  getPending(): UiPendingImageAttachment[];
  handlePaste(event: ClipboardEvent | Event): Promise<void>;
  hasPending(): boolean;
  setSupported(supported: boolean): void;
  supportsInput(): boolean;
}

export function createImageAttachmentController(
  options: ImageAttachmentControllerOptions,
): ImageAttachmentController {
  let state = createImageAttachmentState();
  const rerender = () => {
    render(options, state, (nextState) => {
      state = nextState;
      rerender();
    });
  };

  options.button.addEventListener("click", () => {
    handlePickClick(options, state);
  });
  rerender();

  return {
    applyAdded(data) {
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];
      state = addImageAttachments(state, attachments);
      rerender();
    },
    clear() {
      state = clearImageAttachments(state);
      rerender();
    },
    getPending() {
      return [...state.pending];
    },
    async handlePaste(event) {
      await handleImageAttachmentPaste({
        event,
        onStorePastedImage: options.onStorePastedImage,
        onUnsupportedInput: options.onUnsupportedInput,
        supported: state.supported,
      });
    },
    hasPending() {
      return state.pending.length > 0;
    },
    setSupported(supported) {
      state = setImageAttachmentSupported(state, supported);
      rerender();
    },
    supportsInput() {
      return state.supported;
    },
  };
}

function handlePickClick(
  options: ImageAttachmentControllerOptions,
  state: ImageAttachmentState,
): void {
  if (!state.supported) {
    options.onUnsupportedInput();
    return;
  }
  options.onRequestPick();
}

function render(
  options: ImageAttachmentControllerOptions,
  state: ImageAttachmentState,
  onRemoveAttachment: (nextState: ImageAttachmentState) => void,
): void {
  syncImageAttachmentUi(
    {
      button: options.button,
      list: options.list,
      onRemoveAttachment(id) {
        onRemoveAttachment(removeImageAttachment(state, id));
      },
    },
    {
      pending: state.pending,
      supported: state.supported,
    },
  );
}
