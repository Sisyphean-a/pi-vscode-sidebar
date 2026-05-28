import type { SidebarController } from "../../../host/controller.ts";
import type { HostToUiMessage, UiPendingImageAttachment } from "../../protocol.ts";
import { parseUiMessage } from "../../protocol.ts";

interface CreateProviderMessageHandlerOptions {
  controller: Pick<SidebarController, "handleUiMessage">;
  createPastedImageAttachment(
    dataUrl: string,
    mimeType: string,
    name?: string,
  ): UiPendingImageAttachment;
  markWebviewReady(): Promise<void>;
  openFileReference(path: string, startLine: number, endLine?: number): Promise<void>;
  pickImageAttachments(): Promise<UiPendingImageAttachment[]>;
  postHostMessage(message: HostToUiMessage): Promise<void>;
  showInvalidMessage(): void;
}

export interface ProviderMessageHandler {
  handle(payload: unknown): Promise<void>;
}

export function createProviderMessageHandler(
  options: CreateProviderMessageHandlerOptions,
): ProviderMessageHandler {
  let pendingMessage = Promise.resolve();

  return {
    handle(payload) {
      const nextMessage = pendingMessage.then(async () => {
        await handleMessage(payload);
      });
      pendingMessage = nextMessage.catch(() => undefined);
      return nextMessage;
    },
  };

  async function handleMessage(payload: unknown): Promise<void> {
    const message = parseUiMessage(payload);
    if (!message) {
      options.showInvalidMessage();
      return;
    }
    if (message.type === "open_file_reference") {
      await options.openFileReference(message.path, message.startLine, message.endLine);
      return;
    }
    if (message.type === "pick_image_attachments") {
      await postImageAttachments(await options.pickImageAttachments());
      return;
    }
    if (message.type === "store_pasted_image_attachment") {
      await postImageAttachments([
        options.createPastedImageAttachment(message.dataUrl, message.mimeType, message.name),
      ]);
      return;
    }
    if (message.type === "ui_ready") {
      await options.markWebviewReady();
    }
    await options.controller.handleUiMessage(message).catch(async (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      await options.postHostMessage({ type: "error", scope: "rpc", message: detail });
    });
  }

  async function postImageAttachments(attachments: UiPendingImageAttachment[]): Promise<void> {
    if (attachments.length === 0) return;
    await options.postHostMessage({
      type: "image_attachments_added",
      data: { attachments },
    });
  }
}
