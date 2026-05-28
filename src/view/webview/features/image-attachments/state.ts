import type { UiPendingImageAttachment } from "../../../protocol.ts";

export interface ImageAttachmentState {
  pending: UiPendingImageAttachment[];
  supported: boolean;
}

export function createImageAttachmentState(): ImageAttachmentState {
  return {
    pending: [],
    supported: false,
  };
}

export function addImageAttachments(
  state: ImageAttachmentState,
  attachments: UiPendingImageAttachment[],
): ImageAttachmentState {
  if (attachments.length === 0) return state;
  return {
    ...state,
    pending: [...state.pending, ...attachments],
  };
}

export function removeImageAttachment(
  state: ImageAttachmentState,
  attachmentId: string,
): ImageAttachmentState {
  return {
    ...state,
    pending: state.pending.filter((attachment) => attachment.id !== attachmentId),
  };
}

export function setImageAttachmentSupported(
  state: ImageAttachmentState,
  supported: boolean,
): ImageAttachmentState {
  if (state.supported === supported) return state;
  return {
    ...state,
    supported,
  };
}

export function clearImageAttachments(state: ImageAttachmentState): ImageAttachmentState {
  if (state.pending.length === 0) return state;
  return {
    ...state,
    pending: [],
  };
}
