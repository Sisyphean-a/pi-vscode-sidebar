import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import * as vscode from "vscode";
import type { UiPendingImageAttachment } from "../../protocol.ts";

export async function pickImageAttachments(): Promise<UiPendingImageAttachment[]> {
  const selections = await vscode.window.showOpenDialog({
    canSelectMany: true,
    canSelectFiles: true,
    canSelectFolders: false,
    openLabel: "选择图片",
    filters: {
      Images: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
    },
  });
  if (!selections || selections.length === 0) return [];
  return Promise.all(selections.map((uri) => createAttachmentFromFile(uri)));
}

export function createPastedImageAttachment(
  dataUrl: string,
  mimeType: string,
  name?: string,
): UiPendingImageAttachment {
  const extension = mimeTypeToExtension(mimeType);
  const targetName = name?.trim() || `pasted-image.${extension}`;
  return {
    id: randomUUID(),
    name: targetName,
    previewUrl: dataUrl,
    image: {
      type: "image",
      data: stripDataUrlPrefix(dataUrl, mimeType),
      mimeType,
    },
  };
}

async function createAttachmentFromFile(uri: vscode.Uri): Promise<UiPendingImageAttachment> {
  const fileBytes = await vscode.workspace.fs.readFile(uri);
  const mimeType = extensionToMimeType(extname(uri.fsPath).toLowerCase());
  const base64Data = Buffer.from(fileBytes).toString("base64");
  return {
    id: randomUUID(),
    name: basenameFromPath(uri.fsPath),
    previewUrl: `data:${mimeType};base64,${base64Data}`,
    image: {
      type: "image",
      data: base64Data,
      mimeType,
    },
  };
}

function stripDataUrlPrefix(dataUrl: string, mimeType: string): string {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("无效的图片数据。");
  }
  return dataUrl.slice(prefix.length);
}

function extensionToMimeType(extension: string): string {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".bmp") return "image/bmp";
  return "image/png";
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/bmp") return "bmp";
  return "png";
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").at(-1) || path;
}
