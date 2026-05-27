import * as vscode from "vscode";

import type { LogBroadcaster } from "../host/log-broadcaster.ts";
import { renderPanelLogWebviewHtml } from "./panel-log-webview-html.ts";

export interface CreatePanelLogViewProviderOptions {
  extensionUri: vscode.Uri;
  broadcaster: LogBroadcaster;
}

export function createPanelLogViewProvider(options: CreatePanelLogViewProviderOptions) {
  return new PanelLogViewProvider(options.extensionUri, options.broadcaster);
}

class PanelLogViewProvider implements vscode.WebviewViewProvider {
  private unsubscribeLogs: (() => void) | undefined;
  private isReady = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly broadcaster: LogBroadcaster,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "webview")],
    };
    view.webview.html = renderPanelLogWebviewHtml(this.extensionUri, view.webview);
    view.webview.onDidReceiveMessage((payload: unknown) => {
      const type = readMessageType(payload);
      if (type !== "ui_ready") return;
      this.isReady = true;
      this.syncSubscription(view);
    });
    view.onDidChangeVisibility(() => {
      if (!view.visible) {
        this.isReady = false;
      }
      this.syncSubscription(view);
    });
    view.onDidDispose(() => {
      this.isReady = false;
      this.unsubscribe();
    });
    this.syncSubscription(view);
  }

  private syncSubscription(view: vscode.WebviewView): void {
    if (!view.visible || !this.isReady) {
      this.unsubscribe();
      return;
    }
    if (this.unsubscribeLogs) return;
    this.unsubscribeLogs = this.broadcaster.subscribe((line) => {
      void view.webview.postMessage({ type: "log_entry", line });
    });
  }

  private unsubscribe(): void {
    this.unsubscribeLogs?.();
    this.unsubscribeLogs = undefined;
  }
}

function readMessageType(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const type = (payload as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}
