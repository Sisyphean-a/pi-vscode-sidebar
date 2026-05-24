import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import type { SidebarController } from "../host/controller.ts";
import { parseUiMessage, type HostToUiMessage } from "./protocol.ts";

export interface CreateSidebarViewProviderOptions {
  extensionUri: vscode.Uri;
  controller: SidebarController;
}

export function createSidebarViewProvider(
  options: CreateSidebarViewProviderOptions,
): vscode.WebviewViewProvider {
  return new SidebarViewProvider(options.extensionUri, options.controller);
}

class SidebarViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: SidebarController,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void | Thenable<void> {
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
    view.onDidDispose(disconnect);

    view.webview.onDidReceiveMessage((payload: unknown) => {
      const message = parseUiMessage(payload);
      if (!message) {
        void vscode.window.showErrorMessage("侧边栏消息格式无效。");
        return;
      }
      void this.controller.handleUiMessage(message).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        void this.post(view, { type: "error", scope: "rpc", message: detail });
      });
    });
  }

  private async post(view: vscode.WebviewView, message: HostToUiMessage): Promise<void> {
    await view.webview.postMessage(message);
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = randomUUID().replace(/-/g, "");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "app.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", "view", "webview", "styles.css"),
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
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
