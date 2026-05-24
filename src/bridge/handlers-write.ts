import * as vscode from "vscode";
import { serializeRange } from "./serialize.ts";
import type { BridgeState } from "./types.ts";
import {
  readOptionalBoolean,
  readOptionalString,
  readRequiredPosition,
  readRequiredString,
  readSelection,
  readWorkspaceEdits,
  resolveFileUri,
} from "./utils.ts";

export async function openFile(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: readOptionalBoolean(params.preview) ?? false,
    preserveFocus: readOptionalBoolean(params.preserveFocus) ?? false,
  });
  const selection = readSelection(params.selection);
  if (selection) {
    const range = new vscode.Range(selection.start, selection.end);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }
  return {
    opened: true,
    filePath: document.uri.fsPath,
    fileUri: document.uri.toString(),
  };
}

export async function saveDocument(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const document =
    vscode.workspace.textDocuments.find((item) => item.uri.toString() === uri.toString()) ??
    (await vscode.workspace.openTextDocument(uri));
  return {
    filePath: document.uri.fsPath,
    fileUri: document.uri.toString(),
    wasDirty: document.isDirty,
    saved: await document.save(),
    isDirty: document.isDirty,
  };
}

export async function executeCodeAction(params: Record<string, unknown>, state: BridgeState) {
  const actionId = readRequiredString(params.actionId, "actionId", 256);
  const cached = state.codeActions.get(actionId);
  if (!cached) throw new Error(`Unknown or expired code action id: ${actionId}`);

  const { action } = cached;
  let editApplied = false;
  let commandExecuted = false;

  if (action instanceof vscode.CodeAction) {
    if (action.edit) editApplied = await vscode.workspace.applyEdit(action.edit);
    if (action.command) {
      await vscode.commands.executeCommand(
        action.command.command,
        ...(action.command.arguments ?? []),
      );
      commandExecuted = true;
    }
  } else {
    await vscode.commands.executeCommand(action.command, ...(action.arguments ?? []));
    commandExecuted = true;
  }

  state.codeActions.delete(actionId);
  return {
    actionId,
    filePath: cached.filePath,
    title: action.title,
    editApplied,
    commandExecuted,
    audit: {
      actionKind: action instanceof vscode.CodeAction ? "code_action" : "command",
      hadWorkspaceEdit: action instanceof vscode.CodeAction ? !!action.edit : false,
      hadCommand: action instanceof vscode.CodeAction ? !!action.command : true,
    },
  };
}

export async function applyWorkspaceEdit(params: Record<string, unknown>) {
  const edits = readWorkspaceEdits(params.edits);
  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.replace(
      resolveFileUri(edit.filePath),
      new vscode.Range(
        edit.range.start.line,
        edit.range.start.character,
        edit.range.end.line,
        edit.range.end.character,
      ),
      edit.newText,
    );
  }
  return {
    applied: await vscode.workspace.applyEdit(workspaceEdit),
    edits: edits.map((edit) => ({
      filePath: resolveFileUri(edit.filePath).fsPath,
      range: edit.range,
    })),
    audit: {
      editCount: edits.length,
      totalNewTextLength: edits.reduce((sum, edit) => sum + edit.newText.length, 0),
      maxSingleEditTextLength: edits.reduce(
        (maxLength, edit) => Math.max(maxLength, edit.newText.length),
        0,
      ),
    },
  };
}

export async function formatDocument(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const options = await getFormattingOptions(uri);
  const edits =
    (await vscode.commands.executeCommand<vscode.TextEdit[]>(
      "vscode.executeFormatDocumentProvider",
      uri,
      options,
    )) ?? [];
  return applyFormattingEdits(uri, edits);
}

export async function formatRange(params: Record<string, unknown>) {
  const uri = resolveFileUri(readRequiredString(params.filePath, "filePath"));
  const selection = readSelection(params.selection);
  const range = selection
    ? new vscode.Range(selection.start, selection.end)
    : new vscode.Range(
        readRequiredPosition(params.start, "start"),
        readRequiredPosition(params.end, "end"),
      );
  const options = await getFormattingOptions(uri);
  const edits =
    (await vscode.commands.executeCommand<vscode.TextEdit[]>(
      "vscode.executeFormatRangeProvider",
      uri,
      range,
      options,
    )) ?? [];
  return applyFormattingEdits(uri, edits, range);
}

export async function showNotification(params: Record<string, unknown>) {
  const message = readRequiredString(params.message, "message");
  const type = readOptionalString(params.type) ?? "info";
  if (type === "warning") await vscode.window.showWarningMessage(message);
  else if (type === "error") await vscode.window.showErrorMessage(message);
  else await vscode.window.showInformationMessage(message);
  return { shown: true, type, message };
}

export function clearNotifications(state: BridgeState) {
  const cleared = state.notifications.length;
  state.notifications.length = 0;
  return { cleared };
}

export function reportSession(params: Record<string, unknown>, state: BridgeState) {
  const sessionId = readRequiredString(params.sessionId, "sessionId");
  const sessionFile = readRequiredString(params.sessionFile, "sessionFile");
  state.reportSession(sessionId, sessionFile);
  return { received: true };
}

async function getFormattingOptions(uri: vscode.Uri) {
  const document =
    vscode.workspace.textDocuments.find((item) => item.uri.toString() === uri.toString()) ??
    (await vscode.workspace.openTextDocument(uri));
  return {
    insertSpaces:
      vscode.workspace.getConfiguration("editor", document).get<boolean>("insertSpaces") ?? true,
    tabSize: vscode.workspace.getConfiguration("editor", document).get<number>("tabSize") ?? 2,
  };
}

async function applyFormattingEdits(
  uri: vscode.Uri,
  edits: vscode.TextEdit[],
  range?: vscode.Range,
) {
  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const edit of edits) {
    workspaceEdit.replace(uri, edit.range, edit.newText);
  }
  return {
    filePath: uri.fsPath,
    fileUri: uri.toString(),
    range: range ? serializeRange(range) : undefined,
    editCount: edits.length,
    applied: edits.length > 0 ? await vscode.workspace.applyEdit(workspaceEdit) : true,
  };
}
