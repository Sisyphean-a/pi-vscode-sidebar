import { readString } from "./activity-event-zod.ts";

interface VsCodePoster {
  postMessage(message: object): void;
}

export interface UiMessagePoster {
  post(message: Record<string, unknown>): void;
}

export function createUiMessagePoster(vscode: VsCodePoster): UiMessagePoster {
  return {
    post(message) {
      if (readString(message.type) === "ui_ready") {
        vscode.postMessage(message);
        return;
      }
      vscode.postMessage({
        ...message,
        correlationId: createCorrelationId(),
      });
    },
  };
}

function createCorrelationId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `ui-${timePart}-${randomPart}`;
}
