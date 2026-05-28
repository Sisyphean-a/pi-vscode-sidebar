import * as vscode from "vscode";
import { buildPromptReferencePayload, type PromptReferencePayload } from "../../editor-reference.ts";

export function buildActiveEditorPromptReferencePayload(): PromptReferencePayload | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;

  const selection = editor.selection;
  if (
    selection.start.line === selection.end.line &&
    selection.start.character === selection.end.character
  ) {
    return undefined;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const relativePath = workspaceFolder
    ? vscode.workspace.asRelativePath(editor.document.uri, false)
    : editor.document.uri.fsPath;
  return buildPromptReferencePayload({
    path: relativePath,
    start: selection.start,
    end: selection.end,
    selectedText: editor.document.getText(selection),
    documentText: editor.document.getText(),
    languageId: editor.document.languageId,
  });
}

export async function openEditorFileReference(
  path: string,
  startLine: number,
  endLine?: number,
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const targetUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, ...path.split("/"))
    : vscode.Uri.file(path);
  const document = await vscode.workspace.openTextDocument(targetUri);
  const start = new vscode.Position(Math.max(0, startLine - 1), 0);
  const end = new vscode.Position(Math.max(0, (endLine ?? startLine) - 1), 0);
  const selection = new vscode.Selection(start, end);
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  editor.selection = selection;
  editor.revealRange(new vscode.Range(start, end));
}
