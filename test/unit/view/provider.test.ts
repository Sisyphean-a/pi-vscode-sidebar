import { describe, expect, it, vi } from "vitest";
import {
  createSidebarViewProvider,
  type SidebarViewProviderHandle,
} from "../../../src/view/provider.ts";

vi.mock("vscode", () => {
  class MockPosition {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }

  class MockSelection {
    constructor(
      public start: MockPosition,
      public end: MockPosition,
    ) {}
  }

  return {
    Uri: {
      joinPath: (...segments: Array<{ path?: string } | string>) => ({
        path: segments
          .map((segment) => (typeof segment === "string" ? segment : (segment.path ?? "")))
          .join("/"),
        fsPath: segments
          .map((segment) => (typeof segment === "string" ? segment : (segment.path ?? "")))
          .join("/"),
      }),
      file: (path: string) => ({ path, fsPath: path }),
    },
    Range: class MockRange {
      constructor(
        public start: MockPosition,
        public end: MockPosition,
      ) {}
    },
    Position: MockPosition,
    Selection: MockSelection,
    ViewColumn: { One: 1 },
    window: {
      activeTextEditor: undefined,
      showErrorMessage: vi.fn(),
      showTextDocument: vi.fn(async () => ({
        selection: undefined,
        revealRange: vi.fn(),
      })),
    },
    workspace: {
      workspaceFolders: [
        { uri: { fsPath: "E:/github/pi-vscode-sidebar", path: "E:/github/pi-vscode-sidebar" } },
      ],
      asRelativePath: (value: { fsPath?: string } | string) => {
        const path = typeof value === "string" ? value : (value.fsPath ?? "");
        return path.replace("E:/github/pi-vscode-sidebar/", "");
      },
      openTextDocument: vi.fn(async (uri) => ({ uri })),
    },
  };
});

describe("SidebarViewProvider", () => {
  it("inserts active editor selection reference into the webview", async () => {
    const vscode = await import("vscode");
    const postedMessages: unknown[] = [];
    let receivedHandler: ((payload: unknown) => void) | undefined;

    const provider: SidebarViewProviderHandle = createSidebarViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      controller: {
        connect() {
          return () => {};
        },
        async handleUiMessage() {},
        async dispose() {},
      },
    });

    (vscode.window as never as { activeTextEditor: unknown }).activeTextEditor = {
      document: {
        uri: {
          fsPath: "E:/github/pi-vscode-sidebar/src/pi/env.ts",
          path: "E:/github/pi-vscode-sidebar/src/pi/env.ts",
        },
        getText: (selection?: { start?: { line: number }; end?: { line: number } }) =>
          selection ? "line2\nline3" : "line1\nline2\nline3\n",
        languageId: "typescript",
      },
      selection: new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(2, 5)),
      selections: [new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(2, 5))],
      revealRange() {},
    } as never;

    provider.resolveWebviewView(
      {
        webview: {
          options: {},
          html: "",
          asWebviewUri(uri: unknown) {
            return uri as never;
          },
          onDidReceiveMessage(handler: (payload: unknown) => void) {
            receivedHandler = handler;
            return { dispose() {} };
          },
          async postMessage(message: unknown) {
            postedMessages.push(message);
          },
        },
        onDidDispose() {},
      } as never,
      {} as never,
      {} as never,
    );

    await provider.insertActiveEditorReference();

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "insert_prompt_reference" &&
          (message as { data?: { reference?: string } }).data?.reference === "@src/pi/env.ts:2-3",
      ),
    ).toBe(true);
    expect(receivedHandler).toBeTypeOf("function");
  });

  it("opens file reference location when webview asks for it", async () => {
    const vscode = await import("vscode");
    let receivedHandler: ((payload: unknown) => void) | undefined;

    const provider: SidebarViewProviderHandle = createSidebarViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      controller: {
        connect() {
          return () => {};
        },
        async handleUiMessage() {},
        async dispose() {},
      },
    });

    provider.resolveWebviewView(
      {
        webview: {
          options: {},
          html: "",
          asWebviewUri(uri: unknown) {
            return uri as never;
          },
          onDidReceiveMessage(handler: (payload: unknown) => void) {
            receivedHandler = handler;
            return { dispose() {} };
          },
          async postMessage() {
            return true;
          },
        },
        onDidDispose() {},
      } as never,
      {} as never,
      {} as never,
    );

    await receivedHandler?.({
      type: "open_file_reference",
      path: "src/pi/env.ts",
      startLine: 11,
      endLine: 23,
    });

    expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });
});
