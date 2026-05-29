import { h } from "preact";
import type { UiPendingImageAttachment } from "../../../protocol.ts";
import { handleImageAttachmentPaste, type StorePastedImagePayload } from "./paste.ts";
import {
  addImageAttachments,
  clearImageAttachments,
  createImageAttachmentState,
  removeImageAttachment,
  setImageAttachmentSupported,
  type ImageAttachmentState,
} from "./state.ts";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";

interface ImageAttachmentControllerOptions {
  button: ImageAttachmentButtonPort;
  listView: PreactRenderPort;
  onRequestPick(): void;
  onStorePastedImage(payload: StorePastedImagePayload): void;
  onUnsupportedInput(): void;
}

interface ImageAttachmentButtonPort {
  addClickListener(listener: () => void): void;
  setDisabled(disabled: boolean): void;
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
  let state = createImageAttachmentState();
  const updateState = (nextState: ImageAttachmentState) => {
    if (nextState === state) return;
    state = nextState;
    sync();
  };

  const sync = () => {
    syncImageAttachmentUi(
      {
        button: options.button,
        listView: options.listView,
        onRemoveAttachment(id) {
          updateState(removeImageAttachment(state, id));
        },
      },
      {
        pending: state.pending,
        supported: state.supported,
      },
    );
  };
  sync();

  options.button.addClickListener(() => {
    handlePickClick(options, state);
  });

  return {
    applyAdded(data) {
      updateState(addImageAttachments(state, data.attachments));
    },
    clear() {
      updateState(clearImageAttachments(state));
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
      updateState(setImageAttachmentSupported(state, supported));
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

interface ImageAttachmentDomOptions {
  button: ImageAttachmentButtonPort;
  listView: PreactRenderPort;
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
  options.button.setDisabled(!state.supported);
  options.listView.render(
    h(ImageAttachmentCardList, {
      onRemoveAttachment: options.onRemoveAttachment,
      pending: state.pending,
    }),
  );
}

interface ImageAttachmentCardListProps {
  onRemoveAttachment(id: string): void;
  pending: UiPendingImageAttachment[];
}

function ImageAttachmentCardList(props: ImageAttachmentCardListProps) {
  if (props.pending.length === 0) return null;
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
