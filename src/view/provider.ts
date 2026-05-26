import { randomUUID } from "node:crypto";
import { buildPromptReferencePayload } from "./editor-reference.ts";
import { extname } from "node:path";
import * as vscode from "vscode";
import type { SidebarController } from "../host/controller.ts";
import {
  parseUiMessage,
  type HostToUiMessage,
  type UiPendingImageAttachment,
} from "./protocol.ts";

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
  private isWebviewReady = false;
  private readonly pendingMessages: HostToUiMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storageUri: vscode.Uri | undefined,
    private readonly controller: SidebarController,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void | Thenable<void> {
    this.view = view;
    this.isWebviewReady = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist"),
        vscode.Uri.joinPath(this.extensionUri, "src", "view", "webview"),
      ],
    };

    view.webview.html = this.renderHtml(view.webview);
    const disconnect = this.controller.connect((message) => {
      void this.post(view, message);
    });
    view.onDidDispose(() => {
      disconnect();
      if (this.view === view) {
        this.view = undefined;
        this.isWebviewReady = false;
      }
    });

    view.webview.onDidReceiveMessage(async (payload: unknown) => {
      const message = parseUiMessage(payload);
      if (!message) {
        void vscode.window.showErrorMessage("侧边栏消息格式无效。");
        return;
      }
      if (message.type === "open_file_reference") {
        await this.openFileReference(message.path, message.startLine, message.endLine);
        return;
      }
      if (message.type === "pick_image_attachments") {
        await this.pickImageAttachments(view);
        return;
      }
      if (message.type === "store_pasted_image_attachment") {
        await this.storePastedImageAttachment(view, message.dataUrl, message.mimeType, message.name);
        return;
      }
      if (message.type === "ui_ready") {
        this.isWebviewReady = true;
        await this.flushPendingMessages(view);
      }
      await this.controller.handleUiMessage(message).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        void this.post(view, { type: "error", scope: "rpc", message: detail });
      });
    });
  }

  async insertActiveEditorReference(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    if (
      selection.start.line === selection.end.line &&
      selection.start.character === selection.end.character
    ) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const relativePath = workspaceFolder
      ? vscode.workspace.asRelativePath(editor.document.uri, false)
      : editor.document.uri.fsPath;
    const payload = buildPromptReferencePayload({
      path: relativePath,
      start: selection.start,
      end: selection.end,
      selectedText: editor.document.getText(selection),
      documentText: editor.document.getText(),
      languageId: editor.document.languageId,
    });

    await this.postOrQueue({
      type: "insert_prompt_reference",
      data: payload,
    });
  }

  private async postOrQueue(message: HostToUiMessage): Promise<void> {
    const view = this.view;
    if (!view || !this.isWebviewReady) {
      this.pendingMessages.push(message);
      return;
    }
    await this.post(view, message);
  }

  private async flushPendingMessages(view: vscode.WebviewView): Promise<void> {
    if (!this.isWebviewReady || this.pendingMessages.length === 0) return;
    while (this.pendingMessages.length > 0) {
      const nextMessage = this.pendingMessages.shift();
      if (!nextMessage) continue;
      await this.post(view, nextMessage);
    }
  }

  private async post(view: vscode.WebviewView, message: HostToUiMessage): Promise<void> {
    await view.webview.postMessage(message);
  }

  private async openFileReference(
    path: string,
    startLine: number,
    endLine?: number,
  ): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const targetUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, ...path.split("/"))
      : vscode.Uri.file(path);
    const document = await vscode.workspace.openTextDocument(targetUri);
    const start = new vscode.Position(Math.max(0, startLine - 1), 0);
    const end = new vscode.Position(Math.max(0, (endLine ?? startLine) - 1), 0);
    const selection = new vscode.Selection(start, end);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    editor.selection = selection;
    editor.revealRange(new vscode.Range(start, end));
  }

  private async pickImageAttachments(view: vscode.WebviewView): Promise<void> {
    const selections = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: "选择图片",
      filters: {
        Images: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
      },
    });
    if (!selections || selections.length === 0) return;

    const attachments = await Promise.all(
      selections.map((uri) => this.createAttachmentFromFile(uri)),
    );
    await this.post(view, {
      type: "image_attachments_added",
      data: { attachments },
    });
  }

  private async storePastedImageAttachment(
    view: vscode.WebviewView,
    dataUrl: string,
    mimeType: string,
    name?: string,
  ): Promise<void> {
    const extension = mimeTypeToExtension(mimeType);
    const targetName = name?.trim() || `pasted-image.${extension}`;
    await this.post(view, {
      type: "image_attachments_added",
      data: {
        attachments: [
          {
            id: randomUUID(),
            name: targetName,
            previewUrl: dataUrl,
            image: {
              type: "image",
              data: stripDataUrlPrefix(dataUrl, mimeType),
              mimeType,
            },
          },
        ],
      },
    });
  }

  private async createAttachmentFromFile(uri: vscode.Uri): Promise<UiPendingImageAttachment> {
    const fileBytes = await vscode.workspace.fs.readFile(uri);
    const mimeType = extensionToMimeType(extname(uri.fsPath).toLowerCase());
    const base64Data = bytesToBase64(fileBytes);
    return {
      id: randomUUID(),
      name: basenameFromPath(uri.fsPath),
      previewUrl: `data:${mimeType};base64,${base64Data}`,
      image: {
        type: "image",
        data: base64Data,
        mimeType,
      },
    };
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = randomUUID().replace(/-/g, "");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "app.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", "view", "webview", "styles.css"),
    );
    const language = vscode.env.language || "en";

    return `<!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; connect-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <link href="${styleUri}" rel="stylesheet" />
    <title>Pi 侧边栏</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function stripDataUrlPrefix(dataUrl: string, mimeType: string): string {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("无效的图片数据。");
  }
  return dataUrl.slice(prefix.length);
}

function extensionToMimeType(extension: string): string {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".bmp") return "image/bmp";
  return "image/png";
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/bmp") return "bmp";
  return "png";
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").at(-1) || path;
}
