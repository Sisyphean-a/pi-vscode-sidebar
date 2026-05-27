import * as vscode from "vscode";

const PANEL_LOGS_SETTING = "piSidebar.panelLogs.enabled";
const PANEL_LOG_VIEW_ID = "piSidebar.logs";

export function registerPanelLogView(
  context: vscode.ExtensionContext,
  provider: vscode.WebviewViewProvider,
): void {
  let registration = registerIfEnabled(provider);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(PANEL_LOGS_SETTING)) return;
      registration?.dispose();
      registration = registerIfEnabled(provider);
    }),
    {
      dispose() {
        registration?.dispose();
      },
    },
  );
}

function registerIfEnabled(provider: vscode.WebviewViewProvider): vscode.Disposable | undefined {
  if (!isPanelLogsEnabled()) return undefined;
  return vscode.window.registerWebviewViewProvider(PANEL_LOG_VIEW_ID, provider, {
    webviewOptions: {
      retainContextWhenHidden: false,
    },
  });
}

function isPanelLogsEnabled(): boolean {
  return vscode.workspace.getConfiguration("piSidebar").get<boolean>("panelLogs.enabled") ?? true;
}
