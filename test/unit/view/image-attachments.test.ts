// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";
import { createImageAttachmentController } from "../../../src/view/webview/image-attachments.ts";

describe("image attachment controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="pick-button" type="button"></button>
      <div id="attachment-list"></div>
    `;
  });

  it("renders pending attachments, removes them, and hides the list after the last removal", () => {
    const button = getButton();
    const list = getList();
    const controller = createImageAttachmentController({
      button,
      list,
      onRequestPick() {},
      onStorePastedImage() {},
      onUnsupportedInput() {},
    });

    controller.setSupported(true);
    controller.applyAdded({
      attachments: [createAttachment("image-1"), createAttachment("image-2")],
    });

    expect(button.disabled).toBe(false);
    expect(list.classList.contains("hidden")).toBe(false);
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(2);

    (list.querySelector('[data-attachment-id="image-1"]') as HTMLButtonElement | null)?.click();
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(1);
    expect(controller.getPending().map((attachment) => attachment.id)).toEqual(["image-2"]);

    (list.querySelector('[data-attachment-id="image-2"]') as HTMLButtonElement | null)?.click();
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(0);
    expect(list.classList.contains("hidden")).toBe(true);
    expect(controller.hasPending()).toBe(false);
  });

  it("prevents unsupported image pastes and reports the error instead of storing data", async () => {
    const button = getButton();
    const list = getList();
    const onUnsupportedInput = vi.fn();
    const onStorePastedImage = vi.fn();
    const controller = createImageAttachmentController({
      button,
      list,
      onRequestPick() {},
      onStorePastedImage,
      onUnsupportedInput,
    });

    const preventDefault = vi.fn();
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
      clipboardData: {
        items: Array<{
          type: string;
          getAsFile(): File | null;
        }>;
      };
      preventDefault(): void;
    };
    event.clipboardData = {
      items: [
        {
          type: "image/png",
          getAsFile() {
            return new File(["png"], "clipboard.png", { type: "image/png" });
          },
        },
      ],
    };
    event.preventDefault = preventDefault;

    await controller.handlePaste(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onUnsupportedInput).toHaveBeenCalledTimes(1);
    expect(onStorePastedImage).not.toHaveBeenCalled();
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

function getButton(): HTMLButtonElement {
  const button = document.getElementById("pick-button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Missing pick button.");
  }
  return button;
}

function getList(): HTMLElement {
  const list = document.getElementById("attachment-list");
  if (!(list instanceof HTMLElement)) {
    throw new Error("Missing attachment list.");
  }
  return list;
}
