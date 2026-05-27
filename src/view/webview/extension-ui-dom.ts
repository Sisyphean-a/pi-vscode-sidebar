import {
  renderConfirmTemplate,
  renderInputTemplate,
  renderSelectTemplate,
  renderSetEditorTextTemplate,
} from "./extension-ui-templates.ts";

export interface ExtensionUiDomOptions {
  panel: HTMLElement;
  escapeHtml(text: string): string;
  expectElement<TElement extends HTMLElement>(id: string): TElement;
  postResponse(requestId: string, payload: unknown): void;
  queueNotice(message: string): void;
  setEditorText(text: string): void;
}

export function renderExtensionUiNotice(
  options: ExtensionUiDomOptions,
  noticeMessage: string,
): void {
  options.queueNotice(noticeMessage);
  options.panel.replaceChildren();
  options.panel.classList.add("hidden");
}

export function renderExtensionUiSetEditorText(options: ExtensionUiDomOptions, text: string): void {
  options.panel.classList.remove("hidden");
  options.panel.innerHTML = renderSetEditorTextTemplate(text, options.escapeHtml);
  options
    .expectElement<HTMLButtonElement>("ext-apply-editor-text")
    .addEventListener("click", () => {
      const input = options.expectElement<HTMLTextAreaElement>("ext-editor-text");
      options.setEditorText(input.value);
      options.queueNotice("输入内容已更新。");
      options.panel.classList.add("hidden");
    });
  options
    .expectElement<HTMLButtonElement>("ext-cancel-editor-text")
    .addEventListener("click", () => {
      options.panel.classList.add("hidden");
    });
}

export function renderExtensionUiSelect(
  options: ExtensionUiDomOptions,
  request: { requestId: string; titleText: string; options: string[] },
): void {
  options.panel.classList.remove("hidden");
  options.panel.innerHTML = renderSelectTemplate(request, options.escapeHtml);
  bindExtensionUiButtons(options, request.requestId, () => {
    const select = options.expectElement<HTMLSelectElement>("ext-select");
    return select.value;
  });
}

export function renderExtensionUiConfirm(
  options: ExtensionUiDomOptions,
  request: { requestId: string; titleText: string; message: string },
): void {
  options.panel.classList.remove("hidden");
  options.panel.innerHTML = renderConfirmTemplate(request, options.escapeHtml);

  options.expectElement<HTMLButtonElement>("ext-yes").addEventListener("click", () => {
    postExtensionUiResponse(options, request.requestId, true);
  });
  options.expectElement<HTMLButtonElement>("ext-no").addEventListener("click", () => {
    postExtensionUiResponse(options, request.requestId, false);
  });
  options.expectElement<HTMLButtonElement>("ext-cancel").addEventListener("click", () => {
    postExtensionUiResponse(options, request.requestId, null);
  });
}

export function renderExtensionUiInput(
  options: ExtensionUiDomOptions,
  request: {
    requestId: string;
    titleText: string;
    placeholder: string;
    prefill: string;
  },
): void {
  options.panel.classList.remove("hidden");
  options.panel.innerHTML = renderInputTemplate(request, options.escapeHtml);
  bindExtensionUiButtons(options, request.requestId, () => {
    const input = options.expectElement<HTMLTextAreaElement>("ext-input");
    return input.value;
  });
}

function bindExtensionUiButtons(
  options: ExtensionUiDomOptions,
  requestId: string,
  readValue: () => string,
): void {
  options.expectElement<HTMLButtonElement>("ext-submit").addEventListener("click", () => {
    postExtensionUiResponse(options, requestId, readValue());
  });
  options.expectElement<HTMLButtonElement>("ext-cancel").addEventListener("click", () => {
    postExtensionUiResponse(options, requestId, null);
  });
}

function postExtensionUiResponse(
  options: ExtensionUiDomOptions,
  requestId: string,
  payload: unknown,
): void {
  options.postResponse(requestId, payload);
  options.panel.classList.add("hidden");
}
