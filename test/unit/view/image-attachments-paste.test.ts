// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { handleImageAttachmentPaste } from "../../../src/view/webview/image-attachments-paste.ts";

describe("image attachment paste", () => {
  it("reads a pasted image and forwards a store payload when input is supported", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      readAsDataURL(): void {
        this.result = "data:image/png;base64,AAAA";
        this.onload?.();
      }
    }

    (globalThis as unknown as { FileReader: typeof MockFileReader }).FileReader =
      MockFileReader as never;

    const onStorePastedImage = vi.fn();
    const preventDefault = vi.fn();
    const file = new File(["png"], "clipboard.png", { type: "image/png" });
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
            return file;
          },
        },
      ],
    };
    event.preventDefault = preventDefault;

    await handleImageAttachmentPaste({
      event,
      onStorePastedImage,
      onUnsupportedInput() {},
      supported: true,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onStorePastedImage).toHaveBeenCalledWith({
      dataUrl: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      name: "clipboard.png",
    });
  });
});
