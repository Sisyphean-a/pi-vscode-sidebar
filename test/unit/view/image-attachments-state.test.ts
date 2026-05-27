import { describe, expect, it } from "vitest";

import {
  addImageAttachments,
  createImageAttachmentState,
  removeImageAttachment,
  setImageAttachmentSupported,
} from "../../../src/view/webview/image-attachments-state.ts";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";

describe("image attachment state", () => {
  it("adds attachments, removes one by id, and keeps support flag changes isolated", () => {
    const initial = createImageAttachmentState();
    const withSupport = setImageAttachmentSupported(initial, true);
    const withAttachments = addImageAttachments(withSupport, [
      createAttachment("image-1"),
      createAttachment("image-2"),
    ]);
    const afterRemoval = removeImageAttachment(withAttachments, "image-1");

    expect(initial.supported).toBe(false);
    expect(withSupport.supported).toBe(true);
    expect(withSupport.pending).toEqual([]);
    expect(withAttachments.pending.map((attachment) => attachment.id)).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(afterRemoval.pending.map((attachment) => attachment.id)).toEqual(["image-2"]);
    expect(afterRemoval.supported).toBe(true);
  });
});

function createAttachment(id: string): UiPendingImageAttachment {
  return {
    id,
    name: `${id}.png`,
    previewUrl: `blob:${id}`,
    image: { data: "AAAA", mimeType: "image/png", type: "image" },
  };
}
