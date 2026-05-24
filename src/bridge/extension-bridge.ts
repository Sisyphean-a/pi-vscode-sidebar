import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { handleBridgeRpc } from "./handlers.ts";
import { captureSelection, getEditorInfo } from "./serialize.ts";
import { createBridgeHttpServer } from "./server.ts";
import { createBridgeState } from "./state.ts";
import type { BridgeContext } from "./types.ts";

export async function createBridge(
  context: vscode.ExtensionContext,
  onSessionReport?: (sessionId: string, sessionFile: string) => void,
): Promise<BridgeContext> {
  const rpcTimeoutMs = readBridgeRequestTimeoutMs();
  const state = createBridgeState(
    captureSelection(vscode.window.activeTextEditor),
    onSessionReport,
  );
  const dirtyState = new Map<string, boolean>();
  const bridge = await createBridgeHttpServer({
    token: randomUUID(),
    handleRpc: (method, params) => handleBridgeRpc(method, params, state),
    rpcTimeoutMs,
  });

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      state.latestSelection = captureSelection(event.textEditor);
      state.enqueue("selection_changed", state.latestSelection);
    }),
    vscode.languages.onDidChangeDiagnostics((event) => {
      state.enqueue("diagnostics_changed", {
        uris: event.uris.map((uri) => ({ filePath: uri.fsPath, fileUri: uri.toString() })),
      });
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const captured = captureSelection(editor);
      if (captured) state.latestSelection = captured;
      state.enqueue("active_editor_changed", editor ? getEditorInfo(editor) : undefined);
    }),
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      state.enqueue("visible_editors_changed", editors.map(getEditorInfo));
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== "file") return;
      const key = event.document.uri.toString();
      const wasDirty = dirtyState.get(key) ?? false;
      const isDirty = event.document.isDirty;
      if (wasDirty === isDirty) return;
      dirtyState.set(key, isDirty);
      state.enqueue("document_dirty_changed", {
        filePath: event.document.uri.fsPath,
        fileUri: event.document.uri.toString(),
        isDirty,
        languageId: event.document.languageId,
      });
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme !== "file") return;
      dirtyState.set(document.uri.toString(), false);
      state.enqueue("document_saved", {
        filePath: document.uri.fsPath,
        fileUri: document.uri.toString(),
        languageId: document.languageId,
      });
    }),
    { dispose: () => void bridge.dispose() },
  );

  return bridge;
}

function readBridgeRequestTimeoutMs(): number {
  const timeout = vscode.workspace
    .getConfiguration("piSidebar")
    .get<number>("bridgeRequestTimeoutMs");
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) return 15000;
  return Math.max(1000, Math.trunc(timeout));
}
