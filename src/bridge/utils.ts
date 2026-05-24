import { posix, win32 } from "node:path";
import * as vscode from "vscode";

export function getWorkspaceFolders() {
  return (vscode.workspace.workspaceFolders ?? []).map((folder, index) => ({
    index,
    name: folder.name,
    filePath: folder.uri.fsPath,
    uri: folder.uri.toString(),
  }));
}

export function resolveFileUri(filePath: string): vscode.Uri {
  if (!filePath) {
    throw new Error("Missing required parameter: filePath");
  }
  return vscode.Uri.file(resolveFilePath(filePath));
}

export function resolveFilePath(filePath: string): string {
  if (posix.isAbsolute(filePath) || win32.isAbsolute(filePath)) return filePath;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot)
    throw new Error(`Cannot resolve relative path without workspace: ${filePath}`);
  const pathApi = workspaceRoot.includes("\\") ? win32 : posix;
  return pathApi.resolve(workspaceRoot, filePath);
}

export function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  return value;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readPosition(value: unknown): vscode.Position | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const line = readOptionalNumber(record.line);
  const character = readOptionalNumber(record.character);
  if (line === undefined || character === undefined) return undefined;
  return new vscode.Position(line, character);
}

export function readRequiredPosition(value: unknown, name: string): vscode.Position {
  const position = readPosition(value);
  if (!position) throw new Error(`Missing required parameter: ${name}`);
  return position;
}

export function readSelection(
  value: unknown,
): { start: vscode.Position; end: vscode.Position } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const start = readPosition(record.start);
  const end = readPosition(record.end);
  if (!start || !end) return undefined;
  return { start, end };
}

export function readWorkspaceEdits(value: unknown): Array<{
  filePath: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  newText: string;
}> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Missing required parameter: edits");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Invalid workspace edit at index ${index}`);
    }
    const record = entry as Record<string, unknown>;
    const filePath = readRequiredString(record.filePath, `edits[${index}].filePath`);
    const range = readSelection(record.range);
    if (!range) throw new Error(`Invalid workspace edit range at index ${index}`);
    const newText = typeof record.newText === "string" ? record.newText : "";
    return {
      filePath,
      range: {
        start: { line: range.start.line, character: range.start.character },
        end: { line: range.end.line, character: range.end.character },
      },
      newText,
    };
  });
}
