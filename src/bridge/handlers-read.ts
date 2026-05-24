import * as vscode from "vscode";
import {
  captureSelection,
  getEditorInfo,
  serializeCodeAction,
  serializeDiagnostic,
  serializeHover,
  serializeLocation,
  serializeLocationLike,
  serializePosition,
  serializeRange,
  serializeSymbol,
} from "./serialize.ts";
import type { BridgeState } from "./types.ts";
import {
  getWorkspaceFolders,
  readOptionalNumber,
  readRequiredPosition,
  readRequiredString,
  readSelection,
  resolveFileUri,
} from "./utils.ts";

export function getEditorState(state: BridgeState) {
  const activeEditor = vscode.window.activeTextEditor;
  return {
    workspaceFolders: getWorkspaceFolders(),
    activeEditor: activeEditor ? getEditorInfo(activeEditor) : undefined,
    currentSelection: captureSelection(activeEditor),
    latestSelection: state.latestSelection,
    openEditors: getOpenEditors(),
  };
}

export function getOpenEditors() {
  const seen = new Map<string, ReturnType<typeof getEditorInfo>>();
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.scheme !== "file") continue;
    seen.set(editor.document.uri.toString(), getEditorInfo(editor));
  }
  for (const document of vscode.workspace.textDocuments) {
    if (document.uri.scheme !== "file") continue;
    if (seen.has(document.uri.toString())) continue;
    seen.set(document.uri.toString(), {
      filePath: document.uri.fsPath,
      fileUri: document.uri.toString(),
      languageId: document.languageId,
      isDirty: document.isDirty,
      isActive: vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString(),
    });
  }
  return [...seen.values()];
}

export function getDiagnostics(filePath: string | undefined) {
  const entries = filePath
    ? [
        [
          resolveFileUri(filePath),
          vscode.languages.getDiagnostics(resolveFileUri(filePath)),
        ] as const,
      ]
    : vscode.languages.getDiagnostics();

  return entries.map(([uri, diagnostics]) => ({
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    diagnostics: diagnostics.map((diagnostic) => serializeDiagnostic(diagnostic)),
  }));
}

export async function getDocumentSymbols(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const result = await vscode.commands.executeCommand<
    vscode.DocumentSymbol[] | vscode.SymbolInformation[]
  >("vscode.executeDocumentSymbolProvider", uri);
  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    symbols: (result ?? []).map((symbol) => serializeSymbol(symbol)),
  };
}

export async function getDefinitions(params: Record<string, unknown>) {
  return getLocationResults(params, "vscode.executeDefinitionProvider", "definitions");
}

export async function getTypeDefinitions(params: Record<string, unknown>) {
  return getLocationResults(params, "vscode.executeTypeDefinitionProvider", "typeDefinitions");
}

export async function getImplementations(params: Record<string, unknown>) {
  return getLocationResults(params, "vscode.executeImplementationProvider", "implementations");
}

export async function getDeclarations(params: Record<string, unknown>) {
  return getLocationResults(params, "vscode.executeDeclarationProvider", "declarations");
}

export async function getHover(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const position = readRequiredPosition(params.position, "position");
  const result = await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    uri,
    position,
  );
  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    position: serializePosition(position),
    hovers: (result ?? []).map((hover) => serializeHover(hover)),
  };
}

export async function getWorkspaceSymbols(params: Record<string, unknown>) {
  const query = readRequiredString(params.query, "query");
  const result = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    "vscode.executeWorkspaceSymbolProvider",
    query,
  );
  return {
    query,
    symbols: (result ?? []).map((symbol) => serializeSymbol(symbol)),
  };
}

export async function getReferences(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const position = readRequiredPosition(params.position, "position");
  const result = await vscode.commands.executeCommand<vscode.Location[]>(
    "vscode.executeReferenceProvider",
    uri,
    position,
  );
  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    position: serializePosition(position),
    references: (result ?? []).map((location) => serializeLocation(location)),
  };
}

export async function getCodeActions(params: Record<string, unknown>, state: BridgeState) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const selection = readSelection(params.selection);
  const range = selection
    ? new vscode.Range(selection.start, selection.end)
    : new vscode.Range(
        readRequiredPosition(params.start, "start"),
        readRequiredPosition(params.end, "end"),
      );
  const diagnostics = vscode.languages
    .getDiagnostics(uri)
    .filter((diagnostic) => diagnostic.range.intersection(range));

  const result = await vscode.commands.executeCommand<(vscode.Command | vscode.CodeAction)[]>(
    "vscode.executeCodeActionProvider",
    uri,
    range,
  );

  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    range: serializeRange(range),
    diagnostics: diagnostics.map((diagnostic) => serializeDiagnostic(diagnostic)),
    actions: (result ?? []).map((action) =>
      serializeCodeAction(action, state.cacheCodeAction(action, uri.fsPath)),
    ),
  };
}

export function getNotifications(params: Record<string, unknown>, state: BridgeState) {
  const since = readOptionalNumber(params.since);
  const limit = Math.max(1, Math.min(readOptionalNumber(params.limit) ?? 20, 100));
  const notifications = state.notifications.filter((item) =>
    since ? item.timestamp > since : true,
  );
  return {
    notifications: notifications.slice(-limit),
    latestTimestamp: state.notifications.at(-1)?.timestamp,
  };
}

async function getLocationResults(
  params: Record<string, unknown>,
  command: string,
  resultKey: string,
) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const position = readRequiredPosition(params.position, "position");
  const result = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
    command,
    uri,
    position,
  );
  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    position: serializePosition(position),
    [resultKey]: (result ?? []).map((location) => serializeLocationLike(location)),
  };
}
