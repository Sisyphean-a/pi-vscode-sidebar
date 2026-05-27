import { resolveExtensionUiRequest } from "./extension-ui-state.ts";
import {
  renderExtensionUiConfirm,
  renderExtensionUiInput,
  renderExtensionUiNotice,
  renderExtensionUiSelect,
  renderExtensionUiSetEditorText,
} from "./extension-ui-dom.ts";

interface ExtensionUiRendererOptions {
  panel: HTMLElement;
  escapeHtml(text: string): string;
  expectElement<TElement extends HTMLElement>(id: string): TElement;
  postResponse(requestId: string, payload: unknown): void;
  updateStatus(statusKey: string, statusText?: string): void;
  updateTitle(nextTitle: string): void;
  setEditorText(text: string): void;
  queueNotice(message: string): void;
}

export function createExtensionUiRenderer(options: ExtensionUiRendererOptions) {
  return (data: Record<string, unknown>) => {
    const request = resolveExtensionUiRequest(data);
    if (!request) return;

    if (request.type === "select") {
      renderExtensionUiSelect(options, request);
      return;
    }
    if (request.type === "confirm") {
      renderExtensionUiConfirm(options, request);
      return;
    }
    if (request.type === "input") {
      renderExtensionUiInput(options, request);
      return;
    }
    if (request.type === "notify") {
      renderExtensionUiNotice(options, request.noticeMessage);
      return;
    }
    if (request.type === "status") {
      applyStatusUpdate(options, request.statusKey, request.statusText);
      options.panel.classList.add("hidden");
      return;
    }
    if (request.type === "title") {
      applyTitleUpdate(options, request.title);
      options.panel.classList.add("hidden");
      return;
    }
    if (request.type === "set_editor_text") {
      renderExtensionUiSetEditorText(options, request.text);
      return;
    }

    options.panel.classList.add("hidden");
  };
}

function applyStatusUpdate(
  options: ExtensionUiRendererOptions,
  statusKey: string,
  statusText?: string,
): void {
  options.updateStatus(statusKey, statusText);
}

function applyTitleUpdate(options: ExtensionUiRendererOptions, title: string | undefined): void {
  if (!title) return;
  options.updateTitle(title);
}
