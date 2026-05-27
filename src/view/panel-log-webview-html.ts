import { randomUUID } from "node:crypto";
import * as vscode from "vscode";

export function renderPanelLogWebviewHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
): string {
  const nonce = randomUUID().replace(/-/g, "");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "panel-log-app.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "src", "view", "webview", "panel-log-styles.css"),
  );
  const language = vscode.env.language || "en";

  return `<!DOCTYPE html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <link href="${styleUri}" rel="stylesheet" />
    <title>Pi 日志</title>
  </head>
  <body>
    <div id="log-app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
