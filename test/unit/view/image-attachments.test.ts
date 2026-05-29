// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { createImageAttachmentController } from "../../../src/view/webview/features/image-attachments/controller.ts";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("image attachments controller", () => {
  it("syncs button state, renders cards, and handles removal", () => {
    const button = document.createElement("button");
    const list = document.createElement("div");
    const onRequestPick = vi.fn();
    const onUnsupportedInput = vi.fn();
    const onStorePastedImage = vi.fn();
    const controller = createImageAttachmentController({
      button: createButtonPort(button),
      listView: createPreactRenderPort(list),
      onRequestPick,
      onStorePastedImage,
      onUnsupportedInput,
    });

    controller.setSupported(true);
    controller.applyAdded({
      attachments: [createAttachment("image-1"), createAttachment("image-2")],
    });

    expect(button.disabled).toBe(false);
    const cards = list.querySelectorAll(".composer-image-attachment");
    expect(cards).toHaveLength(2);
    const removeButtons = list.querySelectorAll<HTMLButtonElement>(".composer-image-remove");
    removeButtons[1]?.click();
    expect(controller.getPending().map((item) => item.id)).toEqual(["image-1"]);
  });

  it("hides list and disables button when unsupported or empty", () => {
    const button = document.createElement("button");
    const list = document.createElement("div");
    createImageAttachmentController({
      button: createButtonPort(button),
      listView: createPreactRenderPort(list),
      onRequestPick() {},
      onStorePastedImage() {},
      onUnsupportedInput() {},
    });

    expect(button.disabled).toBe(true);
    expect(list.childElementCount).toBe(0);
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(0);
  });

  it("supports add/remove/clear flow and preserves pick behavior by support state", () => {
    const button = document.createElement("button");
    const list = document.createElement("div");
    const onRequestPick = vi.fn();
    const onUnsupportedInput = vi.fn();
    const onStorePastedImage = vi.fn();
    const controller = createImageAttachmentController({
      button: createButtonPort(button),
      listView: createPreactRenderPort(list),
      onRequestPick,
      onStorePastedImage,
      onUnsupportedInput,
    });

    expect(button.disabled).toBe(true);
    button.click();
    expect(onRequestPick).not.toHaveBeenCalled();
    expect(onUnsupportedInput).not.toHaveBeenCalled();

    controller.setSupported(true);
    expect(button.disabled).toBe(false);
    button.click();
    expect(onRequestPick).toHaveBeenCalledTimes(1);

    controller.applyAdded({
      attachments: [createAttachment("image-1"), createAttachment("image-2")],
    });
    expect(controller.hasPending()).toBe(true);
    expect(controller.getPending().map((item) => item.id)).toEqual(["image-1", "image-2"]);
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(2);

    const removeButtons = list.querySelectorAll<HTMLButtonElement>(".composer-image-remove");
    removeButtons[0]?.click();
    expect(controller.getPending().map((item) => item.id)).toEqual(["image-2"]);

    controller.clear();
    expect(controller.hasPending()).toBe(false);
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(0);
  });
});

function createAttachment(id: string): UiPendingImageAttachment {
  return {
    id,
    image: { type: "image", data: "AAAA", mimeType: "image/png" },
    name: `${id}.png`,
    previewUrl: `blob:${id}`,
  };
}

function createButtonPort(button: HTMLButtonElement) {
  return {
    addClickListener(listener: () => void) {
      button.addEventListener("click", listener);
    },
    setDisabled(disabled: boolean) {
      button.disabled = disabled;
    },
  };
}
