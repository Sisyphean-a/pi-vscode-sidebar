export interface StorePastedImagePayload {
  dataUrl: string;
  mimeType: string;
  name: string;
}

interface HandleImageAttachmentPasteOptions {
  event: ClipboardEvent | Event;
  onStorePastedImage(payload: StorePastedImagePayload): void;
  onUnsupportedInput(): void;
  supported: boolean;
}

export async function handleImageAttachmentPaste(
  options: HandleImageAttachmentPasteOptions,
): Promise<void> {
  const clipboardData = "clipboardData" in options.event ? options.event.clipboardData : undefined;
  if (!clipboardData?.items?.length) return;

  for (const item of Array.from(clipboardData.items)) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    options.event.preventDefault();
    if (!options.supported) {
      options.onUnsupportedInput();
      return;
    }
    options.onStorePastedImage({
      dataUrl: await readFileAsDataUrl(file),
      mimeType: file.type || "image/png",
      name: file.name || "pasted-image.png",
    });
    return;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取图片数据。"));
    };
    reader.onerror = () => reject(new Error("无法读取图片数据。"));
    reader.readAsDataURL(file);
  });
}
