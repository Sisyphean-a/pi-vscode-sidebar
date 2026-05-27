import * as vscode from "vscode";
import type { SidebarController } from "../host/controller.ts";
import {
  buildActiveEditorPromptReferencePayload,
  openEditorFileReference,
} from "./provider-editor-actions.ts";
import { createPastedImageAttachment, pickImageAttachments } from "./provider-image-attachments.ts";
import { createProviderMessageHandler } from "./provider-message-handler.ts";
import { createProviderWebviewBridge } from "./provider-webview-bridge.ts";
import { renderSidebarWebviewHtml } from "./provider-webview-html.ts";

export interface CreateSidebarViewProviderOptions {
  extensionUri: vscode.Uri;
  storageUri?: vscode.Uri;
  controller: SidebarController;
}

export interface SidebarViewProviderHandle extends vscode.WebviewViewProvider {
  insertActiveEditorReference(): Promise<void>;
}

export function createSidebarViewProvider(
  options: CreateSidebarViewProviderOptions,
): SidebarViewProviderHandle {
  return new SidebarViewProvider(options.extensionUri, options.storageUri, options.controller);
}

class SidebarViewProvider implements SidebarViewProviderHandle {
  private view: vscode.WebviewView | undefined;
  private readonly webviewBridge = createProviderWebviewBridge();
  private readonly messageHandler = createProviderMessageHandler({
    controller: {
      handleUiMessage: (message) => this.controller.handleUiMessage(message),
    },
    createPastedImageAttachment,
    markWebviewReady: () => this.webviewBridge.markReady(),
    openFileReference: openEditorFileReference,
    pickImageAttachments,
    postHostMessage: (message) => this.webviewBridge.post(message),
    showInvalidMessage() {
      void vscode.window.showErrorMessage("侧边栏消息格式无效。");
    },
  });

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storageUri: vscode.Uri | undefined,
    private readonly controller: SidebarController,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void | Thenable<void> {
    this.view = view;
    this.webviewBridge.bind(view);
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist"),
        vscode.Uri.joinPath(this.extensionUri, "src", "view", "webview"),
      ],
    };

    view.webview.html = renderSidebarWebviewHtml(this.extensionUri, view.webview);
    const disconnect = this.controller.connect((message) => {
      void this.webviewBridge.post(message);
    });
    view.onDidDispose(() => {
      disconnect();
      if (this.view === view) {
        this.view = undefined;
        this.webviewBridge.unbind(view);
      }
    });

    view.webview.onDidReceiveMessage(async (payload: unknown) => {
      await this.messageHandler.handle(payload);
    });
  }

  async insertActiveEditorReference(): Promise<void> {
    const payload = buildActiveEditorPromptReferencePayload();
    if (!payload) return;

    await this.webviewBridge.postOrQueue({
      type: "insert_prompt_reference",
      data: payload,
    });
  }
}
