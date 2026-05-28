import { describe, expect, it, vi } from "vitest";

import { createProviderMessageHandler } from "../../../src/view/extension/provider/message-handler.ts";

describe("provider message handler", () => {
  it("shows an error for invalid ui payloads", async () => {
    const showInvalidMessage = vi.fn();
    const controller = {
      handleUiMessage: vi.fn(),
    };
    const handler = createProviderMessageHandler({
      controller,
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(),
      openFileReference: vi.fn(),
      pickImageAttachments: vi.fn(),
      postHostMessage: vi.fn(),
      showInvalidMessage,
    });

    await handler.handle({ nope: true });

    expect(showInvalidMessage).toHaveBeenCalledTimes(1);
    expect(controller.handleUiMessage).not.toHaveBeenCalled();
  });

  it("opens file references without forwarding them to the controller", async () => {
    const openFileReference = vi.fn();
    const controller = {
      handleUiMessage: vi.fn(),
    };
    const handler = createProviderMessageHandler({
      controller,
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(),
      openFileReference,
      pickImageAttachments: vi.fn(),
      postHostMessage: vi.fn(),
      showInvalidMessage: vi.fn(),
    });

    await handler.handle({
      type: "open_file_reference",
      path: "src/view/provider.ts",
      startLine: 12,
      endLine: 15,
    });

    expect(openFileReference).toHaveBeenCalledWith("src/view/provider.ts", 12, 15);
    expect(controller.handleUiMessage).not.toHaveBeenCalled();
  });

  it("marks the webview ready before forwarding ui_ready to the controller", async () => {
    const steps: string[] = [];
    const handler = createProviderMessageHandler({
      controller: {
        async handleUiMessage() {
          steps.push("controller");
        },
      },
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(async () => {
        steps.push("ready");
      }),
      openFileReference: vi.fn(),
      pickImageAttachments: vi.fn(),
      postHostMessage: vi.fn(),
      showInvalidMessage: vi.fn(),
    });

    await handler.handle({ type: "ui_ready" });

    expect(steps).toEqual(["ready", "controller"]);
  });

  it("serializes send_prompt behind a pending ui_ready flow", async () => {
    const handledTypes: string[] = [];
    let releaseReady!: () => void;
    const readyGate = new Promise<void>((resolve) => {
      releaseReady = resolve;
    });
    const handler = createProviderMessageHandler({
      controller: {
        async handleUiMessage(message) {
          handledTypes.push(message.type);
        },
      },
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(async () => {
        await readyGate;
      }),
      openFileReference: vi.fn(),
      pickImageAttachments: vi.fn(),
      postHostMessage: vi.fn(),
      showInvalidMessage: vi.fn(),
    });

    const readyPromise = handler.handle({ type: "ui_ready" });
    await Promise.resolve();
    const sendPromptPromise = handler.handle({ type: "send_prompt", text: "hi" });
    await Promise.resolve();

    expect(handledTypes).toEqual([]);

    releaseReady();
    await readyPromise;
    await sendPromptPromise;

    expect(handledTypes).toEqual(["ui_ready", "send_prompt"]);
  });

  it("posts picked image attachments back to the webview", async () => {
    const postHostMessage = vi.fn();
    const attachments = [
      {
        id: "image-1",
        name: "cat.png",
        previewUrl: "data:image/png;base64,AAAA",
        image: { type: "image" as const, data: "AAAA", mimeType: "image/png" },
      },
    ];
    const handler = createProviderMessageHandler({
      controller: {
        handleUiMessage: vi.fn(),
      },
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(),
      openFileReference: vi.fn(),
      pickImageAttachments: vi.fn(async () => attachments),
      postHostMessage,
      showInvalidMessage: vi.fn(),
    });

    await handler.handle({ type: "pick_image_attachments" });

    expect(postHostMessage).toHaveBeenCalledWith({
      type: "image_attachments_added",
      data: { attachments },
    });
  });

  it("posts an rpc error back to the webview when controller handling fails", async () => {
    const postHostMessage = vi.fn();
    const handler = createProviderMessageHandler({
      controller: {
        async handleUiMessage() {
          throw new Error("boom");
        },
      },
      createPastedImageAttachment: vi.fn(),
      markWebviewReady: vi.fn(),
      openFileReference: vi.fn(),
      pickImageAttachments: vi.fn(),
      postHostMessage,
      showInvalidMessage: vi.fn(),
    });

    await handler.handle({
      type: "run_command",
      name: "compact",
      rawInput: "/compact",
    });

    expect(postHostMessage).toHaveBeenCalledWith({
      type: "error",
      scope: "rpc",
      message: "boom",
    });
  });
});
