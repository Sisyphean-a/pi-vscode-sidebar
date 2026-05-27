import type * as vscode from "vscode";
import type { HostToUiMessage } from "./protocol.ts";

export interface ProviderWebviewBridge {
  bind(view: vscode.WebviewView): void;
  markReady(): Promise<void>;
  post(message: HostToUiMessage): Promise<void>;
  postOrQueue(message: HostToUiMessage): Promise<void>;
  unbind(view: vscode.WebviewView): void;
}

export function createProviderWebviewBridge(): ProviderWebviewBridge {
  const pendingMessages: HostToUiMessage[] = [];
  let currentView: vscode.WebviewView | undefined;
  let isReady = false;

  return {
    bind(view) {
      currentView = view;
      isReady = false;
    },
    async markReady() {
      isReady = true;
      await flushPendingMessages();
    },
    async post(message) {
      if (!currentView) return;
      await currentView.webview.postMessage(message);
    },
    async postOrQueue(message) {
      if (!currentView || !isReady) {
        pendingMessages.push(message);
        return;
      }
      await currentView.webview.postMessage(message);
    },
    unbind(view) {
      if (currentView !== view) return;
      currentView = undefined;
      isReady = false;
    },
  };

  async function flushPendingMessages(): Promise<void> {
    if (!currentView || !isReady || pendingMessages.length === 0) return;
    while (pendingMessages.length > 0) {
      const nextMessage = pendingMessages.shift();
      if (!nextMessage) continue;
      await currentView.webview.postMessage(nextMessage);
    }
  }
}
