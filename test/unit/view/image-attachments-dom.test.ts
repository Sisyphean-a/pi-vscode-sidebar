// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";
import { syncImageAttachmentUi } from "../../../src/view/webview/image-attachments-dom.ts";

describe("image attachment dom", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="pick-button" type="button"></button>
      <div id="attachment-list"></div>
    `;
  });

  it("disables the picker and hides the list when no attachments are pending", () => {
    const button = getButton();
    const list = getList();

    syncImageAttachmentUi(
      {
        button,
        list,
        onRemoveAttachment() {},
      },
      {
        pending: [],
        supported: false,
      },
    );

    expect(button.disabled).toBe(true);
    expect(list.classList.contains("hidden")).toBe(true);
    expect(list.childElementCount).toBe(0);
  });

  it("renders attachment cards and wires remove buttons back to the caller", () => {
    const button = getButton();
    const list = getList();
    const onRemoveAttachment = vi.fn();

    syncImageAttachmentUi(
      {
        button,
        list,
        onRemoveAttachment,
      },
      {
        pending: [createAttachment("image-1"), createAttachment("image-2")],
        supported: true,
      },
    );

    expect(button.disabled).toBe(false);
    expect(list.classList.contains("hidden")).toBe(false);
    expect(list.querySelectorAll(".composer-image-attachment")).toHaveLength(2);
    expect(list.querySelector(".composer-image-preview")?.getAttribute("alt")).toBe("image-1.png");

    (list.querySelector('[data-attachment-id="image-2"]') as HTMLButtonElement | null)?.click();
    expect(onRemoveAttachment).toHaveBeenCalledWith("image-2");
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
