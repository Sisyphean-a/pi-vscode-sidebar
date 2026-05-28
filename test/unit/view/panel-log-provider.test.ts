import { describe, expect, it, vi } from "vitest";

import { createLogBroadcaster } from "../../../src/host/log-broadcaster.ts";
import { createPanelLogViewProvider } from "../../../src/view/extension/panel-log/provider.ts";

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
  it("replays buffered lines when the panel is reopened", () => {
    const broadcaster = createLogBroadcaster();
    const provider = createPanelLogViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      broadcaster,
    });
    const first = createPanelLogTestView();

    broadcaster.publish('{"message":"before-open"}');
    provider.resolveWebviewView(first.view as never);
    void first.receivedHandler?.({ type: "ui_ready" });
    broadcaster.publish('{"message":"one"}');
    first.disposeHandler?.();

    const reopened = createPanelLogTestView();
    provider.resolveWebviewView(reopened.view as never);
    void reopened.receivedHandler?.({ type: "ui_ready" });

    expect(first.postedMessages).toEqual([
      { type: "log_history", lines: [] },
      { type: "log_entry", line: '{"message":"one"}' },
    ]);
    expect(reopened.postedMessages).toEqual([
      { type: "log_history", lines: ['{"message":"one"}'] },
    ]);
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
      { type: "log_history", lines: [] },
      { type: "log_entry", line: '{"message":"one"}' },
      { type: "log_history", lines: ['{"message":"one"}', '{"message":"two"}'] },
      { type: "log_entry", line: '{"message":"three"}' },
    ]);
  });

  it("clears buffered logs and resets the webview on request", () => {
    const broadcaster = createLogBroadcaster();
    const statefulBroadcaster = broadcaster as typeof broadcaster & { readHistory(): string[] };
    const provider = createPanelLogViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      broadcaster,
    });
    const fixture = createPanelLogTestView();

    provider.resolveWebviewView(fixture.view as never);
    void fixture.receivedHandler?.({ type: "ui_ready" });
    broadcaster.publish('{"message":"one"}');
    void fixture.receivedHandler?.({ type: "clear_panel_logs" });

    expect(statefulBroadcaster.readHistory?.()).toEqual([]);
    expect(fixture.postedMessages).toEqual([
      { type: "log_history", lines: [] },
      { type: "log_entry", line: '{"message":"one"}' },
      { type: "log_reset" },
    ]);
  });
});

function createPanelLogTestView() {
  const postedMessages: unknown[] = [];
  let receivedHandler: ((payload: unknown) => void) | undefined;
  let disposeHandler: (() => void) | undefined;
  let visibilityHandler: (() => void) | undefined;
  let visible = true;

  return {
    get disposeHandler() {
      return disposeHandler;
    },
    get postedMessages() {
      return postedMessages;
    },
    get receivedHandler() {
      return receivedHandler;
    },
    set visible(nextVisible: boolean) {
      visible = nextVisible;
    },
    get visibilityHandler() {
      return visibilityHandler;
    },
    view: {
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
      onDidDispose(handler: () => void) {
        disposeHandler = handler;
        return { dispose() {} };
      },
    },
  };
}
