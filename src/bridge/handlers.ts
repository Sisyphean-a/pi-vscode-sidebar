import { captureSelection } from "./serialize.ts";
import type { BridgeState } from "./types.ts";
import { getWorkspaceFolders } from "./utils.ts";
import {
  getCodeActions,
  getDeclarations,
  getDefinitions,
  getDiagnostics,
  getDocumentSymbols,
  getEditorState,
  getHover,
  getImplementations,
  getNotifications,
  getOpenEditors,
  getReferences,
  getTypeDefinitions,
  getWorkspaceSymbols,
} from "./handlers-read.ts";
import {
  applyWorkspaceEdit,
  clearNotifications,
  executeCodeAction,
  formatDocument,
  formatRange,
  openFile,
  reportSession,
  saveDocument,
  showNotification,
} from "./handlers-write.ts";
import * as vscode from "vscode";

type BridgeHandler = (
  params: Record<string, unknown>,
  state: BridgeState,
) => Promise<unknown> | unknown;

const BRIDGE_HANDLERS: Record<string, BridgeHandler> = {
  getEditorState: (_params, state) => getEditorState(state),
  getCurrentSelection: (_params, state) =>
    captureSelection(vscode.window.activeTextEditor) ?? state.latestSelection,
  getLatestSelection: (_params, state) => state.latestSelection,
  getDiagnostics: (params) => getDiagnostics(readOptionalFilePath(params)),
  getOpenEditors: () => getOpenEditors(),
  getWorkspaceFolders: () => getWorkspaceFolders(),
  openFile: (params) => openFile(params),
  saveDocument: (params) => saveDocument(params),
  getDocumentSymbols: (params) => getDocumentSymbols(params),
  getDefinitions: (params) => getDefinitions(params),
  getTypeDefinitions: (params) => getTypeDefinitions(params),
  getImplementations: (params) => getImplementations(params),
  getDeclarations: (params) => getDeclarations(params),
  getHover: (params) => getHover(params),
  getWorkspaceSymbols: (params) => getWorkspaceSymbols(params),
  getReferences: (params) => getReferences(params),
  getCodeActions: (params, state) => getCodeActions(params, state),
  executeCodeAction: (params, state) => executeCodeAction(params, state),
  applyWorkspaceEdit: (params) => applyWorkspaceEdit(params),
  formatDocument: (params) => formatDocument(params),
  formatRange: (params) => formatRange(params),
  showNotification: (params) => showNotification(params),
  getNotifications: (params, state) => getNotifications(params, state),
  clearNotifications: (_params, state) => clearNotifications(state),
  reportTerminalSession: (params, state) => reportSession(params, state),
};

export async function handleBridgeRpc(
  method: string,
  params: Record<string, unknown>,
  state: BridgeState,
): Promise<unknown> {
  const handler = BRIDGE_HANDLERS[method];
  if (!handler) throw new Error(`Unknown bridge method: ${method}`);
  return handler(params, state);
}

function readOptionalFilePath(params: Record<string, unknown>): string | undefined {
  return typeof params.filePath === "string" ? params.filePath : undefined;
}
