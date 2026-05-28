import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
import type { UiPendingImageAttachment } from "../../../protocol.ts";
import {
  handleImageAttachmentPaste,
  type StorePastedImagePayload,
} from "./paste.ts";
import {
  addImageAttachments,
  clearImageAttachments,
  createImageAttachmentState,
  removeImageAttachment,
  setImageAttachmentSupported,
  type ImageAttachmentState,
} from "./state.ts";

interface ImageAttachmentControllerOptions {
  button: HTMLButtonElement;
  list: HTMLElement;
  onRequestPick(): void;
  onStorePastedImage(payload: StorePastedImagePayload): void;
  onUnsupportedInput(): void;
}

export interface ImageAttachmentController {
  applyAdded(data: { attachments: UiPendingImageAttachment[] }): void;
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
  const stateSignal = signal(createImageAttachmentState());

  effect(() => {
    const state = stateSignal.value;
    syncImageAttachmentUi(
      {
        button: options.button,
        list: options.list,
        onRemoveAttachment(id) {
          stateSignal.value = removeImageAttachment(stateSignal.value, id);
        },
      },
      {
        pending: state.pending,
        supported: state.supported,
      },
    );
  });

  options.button.addEventListener("click", () => {
    handlePickClick(options, stateSignal.value);
  });

  return {
    applyAdded(data) {
      stateSignal.value = addImageAttachments(stateSignal.value, data.attachments);
    },
    clear() {
      stateSignal.value = clearImageAttachments(stateSignal.value);
    },
    getPending() {
      return [...stateSignal.value.pending];
    },
    async handlePaste(event) {
      await handleImageAttachmentPaste({
        event,
        onStorePastedImage: options.onStorePastedImage,
        onUnsupportedInput: options.onUnsupportedInput,
        supported: stateSignal.value.supported,
      });
    },
    hasPending() {
      return stateSignal.value.pending.length > 0;
    },
    setSupported(supported) {
      stateSignal.value = setImageAttachmentSupported(stateSignal.value, supported);
    },
    supportsInput() {
      return stateSignal.value.supported;
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

interface ImageAttachmentDomOptions {
  button: HTMLButtonElement;
  list: HTMLElement;
  onRemoveAttachment(id: string): void;
}

interface ImageAttachmentDomState {
  pending: UiPendingImageAttachment[];
  supported: boolean;
}

function syncImageAttachmentUi(
  options: ImageAttachmentDomOptions,
  state: ImageAttachmentDomState,
): void {
  options.button.disabled = !state.supported;
  options.list.classList.toggle("hidden", state.pending.length === 0);
  render(
    h(ImageAttachmentCardList, {
      onRemoveAttachment: options.onRemoveAttachment,
      pending: state.pending,
    }),
    options.list,
  );
}

interface ImageAttachmentCardListProps {
  onRemoveAttachment(id: string): void;
  pending: UiPendingImageAttachment[];
}

function ImageAttachmentCardList(props: ImageAttachmentCardListProps) {
  return props.pending.map((attachment) =>
    h(
      "article",
      {
        class: "composer-image-attachment",
        key: attachment.id,
      },
      h("img", {
        alt: attachment.name,
        class: "composer-image-preview",
        src: attachment.previewUrl,
      }),
      h(
        "button",
        {
          "aria-label": "移除图片",
          class: "composer-image-remove",
          "data-attachment-id": attachment.id,
          onClick() {
            props.onRemoveAttachment(attachment.id);
          },
          title: "移除图片",
          type: "button",
        },
        h(
          "svg",
          {
            "aria-hidden": "true",
            fill: "none",
            height: "10",
            viewBox: "0 0 10 10",
            width: "10",
          },
          h("path", {
            d: "M2 2l6 6M8 2L2 8",
            stroke: "currentColor",
            strokeLinecap: "round",
            strokeWidth: "1.6",
          }),
        ),
      ),
    ),
  );
}
