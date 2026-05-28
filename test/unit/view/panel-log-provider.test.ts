import { describe, expect, it, vi } from "vitest";

import { createLogBroadcaster } from "../../../src/host/log-broadcaster.ts";
import { createPanelLogViewProvider } from "../../../src/view/panel-log-provider.ts";

vi.mock("vscode", () => ({
  Uri: {
    joinPath: (...segments: Array<{ path?: string } | string>) => ({
      path: segments
        .map((segment) => (typeof segment === "string" ? segment : (segment.path ?? "")))
        .join("/"),
      fsPath: segments
        .map((segment) => (typeof segment === "string" ? segment : (segment.path ?? "")))
        .join("/"),
    }),
  },
  env: {
    language: "zh-CN",
  },
}));

describe("panel log view provider", () => {
  it("subscribes on resolve and unsubscribes on dispose", () => {
    const broadcaster = createLogBroadcaster();
    const provider = createPanelLogViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      broadcaster,
    });
    const postedMessages: unknown[] = [];
    let receivedHandler: ((payload: unknown) => void) | undefined;
    let disposeHandler: (() => void) | undefined;

    provider.resolveWebviewView({
      webview: {
        options: {},
        html: "",
        asWebviewUri(uri: unknown) {
          return (uri as { path?: string }).path as never;
        },
        onDidReceiveMessage(handler: (payload: unknown) => void) {
          receivedHandler = handler;
          return { dispose() {} };
        },
        async postMessage(message: unknown) {
          postedMessages.push(message);
          return true;
        },
      },
      visible: true,
      onDidChangeVisibility() {
        return { dispose() {} };
      },
      onDidDispose(handler: () => void) {
        disposeHandler = handler;
      },
    } as never);

    void receivedHandler?.({ type: "ui_ready" });
    broadcaster.publish('{"message":"before"}');
    disposeHandler?.();
    broadcaster.publish('{"message":"after"}');

    expect(postedMessages).toEqual([{ type: "log_entry", line: '{"message":"before"}' }]);
  });

  it("stops forwarding while hidden and resumes after becoming visible again", () => {
    const broadcaster = createLogBroadcaster();
    const provider = createPanelLogViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      broadcaster,
    });
    const postedMessages: unknown[] = [];
    let receivedHandler: ((payload: unknown) => void) | undefined;
    let visibilityHandler: (() => void) | undefined;
    let visible = true;

    const view = {
      webview: {
        options: {},
        html: "",
        asWebviewUri(uri: unknown) {
          return (uri as { path?: string }).path as never;
        },
        onDidReceiveMessage(handler: (payload: unknown) => void) {
          receivedHandler = handler;
          return { dispose() {} };
        },
        async postMessage(message: unknown) {
          postedMessages.push(message);
          return true;
        },
      },
      get visible() {
        return visible;
      },
      onDidChangeVisibility(handler: () => void) {
        visibilityHandler = handler;
        return { dispose() {} };
      },
      onDidDispose() {
        return { dispose() {} };
      },
    };

    provider.resolveWebviewView(view as never);

    void receivedHandler?.({ type: "ui_ready" });
    broadcaster.publish('{"message":"one"}');

    visible = false;
    visibilityHandler?.();
    broadcaster.publish('{"message":"two"}');

    visible = true;
    visibilityHandler?.();
    void receivedHandler?.({ type: "ui_ready" });
    broadcaster.publish('{"message":"three"}');

    expect(postedMessages).toEqual([
      { type: "log_entry", line: '{"message":"one"}' },
      { type: "log_entry", line: '{"message":"three"}' },
    ]);
  });
});
