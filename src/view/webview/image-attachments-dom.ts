import type { UiPendingImageAttachment } from "../protocol.ts";

export interface ImageAttachmentDomOptions {
  button: HTMLButtonElement;
  list: HTMLElement;
  onRemoveAttachment(id: string): void;
}

export interface ImageAttachmentDomState {
  pending: UiPendingImageAttachment[];
  supported: boolean;
}

export function syncImageAttachmentUi(
  options: ImageAttachmentDomOptions,
  state: ImageAttachmentDomState,
): void {
  options.button.disabled = !state.supported;
  options.list.replaceChildren();
  if (state.pending.length === 0) {
    options.list.classList.add("hidden");
    return;
  }

  options.list.classList.remove("hidden");
  for (const attachment of state.pending) {
    options.list.append(createImageAttachmentCard(attachment, options.onRemoveAttachment));
  }
}

function createImageAttachmentCard(
  attachment: UiPendingImageAttachment,
  onRemoveAttachment: (id: string) => void,
): HTMLElement {
  const card = document.createElement("article");
  card.className = "composer-image-attachment";

  const preview = document.createElement("img");
  preview.className = "composer-image-preview";
  preview.src = attachment.previewUrl;
  preview.alt = attachment.name;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "composer-image-remove";
  removeButton.dataset.attachmentId = attachment.id;
  removeButton.setAttribute("aria-label", "移除图片");
  removeButton.title = "移除图片";
  removeButton.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  removeButton.addEventListener("click", () => {
    onRemoveAttachment(attachment.id);
  });

  card.append(preview, removeButton);
  return card;
}
