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
    env: {
      language: "zh-CN",
    },
    window: {
      activeTextEditor: undefined,
      showErrorMessage: vi.fn(),
      showOpenDialog: vi.fn(async () => []),
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
      fs: {
        readFile: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
        writeFile: vi.fn(async () => {}),
        createDirectory: vi.fn(async () => {}),
      },
    },
  };
});

describe("SidebarViewProvider", () => {
  it("renders webview html with the current VS Code language", async () => {
    const vscode = await import("vscode");
    let renderedHtml = "";

    (vscode.env as { language: string }).language = "en-US";

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
          get html() {
            return renderedHtml;
          },
          set html(value: string) {
            renderedHtml = value;
          },
          asWebviewUri(uri: unknown) {
            return uri as never;
          },
          onDidReceiveMessage() {
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

    expect(renderedHtml).toContain('<html lang="en-US">');
  });

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

    await receivedHandler?.({ type: "ui_ready" });
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

  it("queues selection insertion until the webview is resolved and ready", async () => {
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

    await provider.insertActiveEditorReference();
    expect(postedMessages).toHaveLength(0);

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

    expect(postedMessages).toHaveLength(0);
    await receivedHandler?.({ type: "ui_ready" });

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "insert_prompt_reference" &&
          (message as { data?: { reference?: string } }).data?.reference === "@src/pi/env.ts:2-3",
      ),
    ).toBe(true);
  });

  it("forwards ui messages to the controller after provider-specific handling", async () => {
    const handledMessages: unknown[] = [];
    let receivedHandler: ((payload: unknown) => void) | undefined;

    const provider: SidebarViewProviderHandle = createSidebarViewProvider({
      extensionUri: { path: "ext", fsPath: "ext" } as never,
      controller: {
        connect() {
          return () => {};
        },
        async handleUiMessage(message) {
          handledMessages.push(message);
        },
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

    await receivedHandler?.({ type: "ui_ready" });
    await receivedHandler?.({
      type: "run_command",
      name: "compact",
      rawInput: "/compact",
      correlationId: "run-1",
    });

    expect(handledMessages).toContainEqual({ type: "ui_ready" });
    expect(handledMessages).toContainEqual({
      type: "run_command",
      name: "compact",
      rawInput: "/compact",
      correlationId: "run-1",
    });
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

  it("posts picked image attachments back to the webview", async () => {
    const vscode = await import("vscode");
    const postedMessages: unknown[] = [];
    let receivedHandler: ((payload: unknown) => void) | undefined;

    (
      vscode.window as never as {
        showOpenDialog: ReturnType<typeof vi.fn>;
      }
    ).showOpenDialog = vi.fn(async () => [
      { fsPath: "C:/images/cat.png", path: "C:/images/cat.png" },
    ]);

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
          async postMessage(message: unknown) {
            postedMessages.push(message);
            return true;
          },
        },
        onDidDispose() {},
      } as never,
      {} as never,
      {} as never,
    );

    await receivedHandler?.({ type: "ui_ready" });
    await receivedHandler?.({ type: "pick_image_attachments", correlationId: "pick-1" });

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "image_attachments_added",
      ),
    ).toBe(true);
  });

  it("stores pasted image attachments and posts them back to the webview", async () => {
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
            return true;
          },
        },
        onDidDispose() {},
      } as never,
      {} as never,
      {} as never,
    );

    await receivedHandler?.({ type: "ui_ready" });
    await receivedHandler?.({
      type: "store_pasted_image_attachment",
      correlationId: "paste-1",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      mimeType: "image/png",
      name: "clipboard.png",
    });

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "image_attachments_added",
      ),
    ).toBe(true);
  });
});
