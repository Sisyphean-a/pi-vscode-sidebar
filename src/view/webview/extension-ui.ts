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
    const requestId = readString(data.id);
    const method = readString(data.method);
    if (!method) return;

    if (method === "select") {
      if (!requestId) return;
      const titleText = readString(data.title) ?? "Input Required";
      options.panel.classList.remove("hidden");
      renderSelectUi(options, requestId, titleText, data);
      return;
    }
    if (method === "confirm") {
      if (!requestId) return;
      const titleText = readString(data.title) ?? "Confirm";
      options.panel.classList.remove("hidden");
      renderConfirmUi(options, requestId, titleText, data);
      return;
    }
    if (method === "input" || method === "editor") {
      if (!requestId) return;
      const titleText = readString(data.title) ?? "Input Required";
      options.panel.classList.remove("hidden");
      renderInputUi(options, requestId, titleText, data);
      return;
    }
    if (method === "notify") {
      options.panel.classList.remove("hidden");
      renderNotifyUi(options, data);
      return;
    }
    if (method === "setStatus") {
      applyStatusUpdate(options, data);
      options.panel.classList.add("hidden");
      return;
    }
    if (method === "setTitle") {
      applyTitleUpdate(options, data);
      options.panel.classList.add("hidden");
      return;
    }
    if (method === "set_editor_text") {
      options.panel.classList.remove("hidden");
      renderSetEditorTextUi(options, data);
      return;
    }

    options.panel.classList.add("hidden");
  };
}

function renderNotifyUi(options: ExtensionUiRendererOptions, data: Record<string, unknown>): void {
  const message = readString(data.message) ?? "Notification received.";
  const level = readString(data.level) ?? readString(data.type) ?? "info";
  options.queueNotice(`[${level}] ${message}`);
  options.panel.innerHTML = `
    <h2>Notification</h2>
    <p>${options.escapeHtml(message)}</p>
    <p><small>level: ${options.escapeHtml(level)}</small></p>
    <div class="line">
      <button id="ext-dismiss" type="button">Dismiss</button>
    </div>
  `;
  options.expectElement<HTMLButtonElement>("ext-dismiss").addEventListener("click", () => {
    options.panel.classList.add("hidden");
  });
}

function applyStatusUpdate(
  options: ExtensionUiRendererOptions,
  data: Record<string, unknown>,
): void {
  const statusKey = readString(data.statusKey) ?? "custom";
  const statusText = readString(data.statusText);
  options.updateStatus(statusKey, statusText);
}

function applyTitleUpdate(
  options: ExtensionUiRendererOptions,
  data: Record<string, unknown>,
): void {
  const title = readString(data.title);
  if (!title) return;
  options.updateTitle(title);
}

function renderSetEditorTextUi(
  options: ExtensionUiRendererOptions,
  data: Record<string, unknown>,
): void {
  const text = readString(data.text) ?? "";
  options.panel.innerHTML = `
    <h2>Edit Prompt Text</h2>
    <textarea id="ext-editor-text" rows="6">${options.escapeHtml(text)}</textarea>
    <div class="line">
      <button id="ext-apply-editor-text" type="button">Apply</button>
      <button id="ext-cancel-editor-text" type="button">Cancel</button>
    </div>
  `;
  options
    .expectElement<HTMLButtonElement>("ext-apply-editor-text")
    .addEventListener("click", () => {
      const input = options.expectElement<HTMLTextAreaElement>("ext-editor-text");
      options.setEditorText(input.value);
      options.queueNotice("Editor text updated.");
      options.panel.classList.add("hidden");
    });
  options
    .expectElement<HTMLButtonElement>("ext-cancel-editor-text")
    .addEventListener("click", () => {
      options.panel.classList.add("hidden");
    });
}

function renderSelectUi(
  options: ExtensionUiRendererOptions,
  requestId: string,
  titleText: string,
  data: Record<string, unknown>,
): void {
  const values = Array.isArray(data.options)
    ? data.options.filter((v) => typeof v === "string")
    : [];
  const optionHtml = values
    .map(
      (item) => `<option value="${options.escapeHtml(item)}">${options.escapeHtml(item)}</option>`,
    )
    .join("");

  options.panel.innerHTML = `
    <h2>${options.escapeHtml(titleText)}</h2>
    <select id="ext-select">${optionHtml}</select>
    <div class="line">
      <button id="ext-submit" type="button">Submit</button>
      <button id="ext-cancel" type="button">Cancel</button>
    </div>
  `;

  bindExtensionUiButtons(options, requestId, () => {
    const select = options.expectElement<HTMLSelectElement>("ext-select");
    return select.value;
  });
}

function renderConfirmUi(
  options: ExtensionUiRendererOptions,
  requestId: string,
  titleText: string,
  data: Record<string, unknown>,
): void {
  const message = readString(data.message) ?? "";
  options.panel.innerHTML = `
    <h2>${options.escapeHtml(titleText)}</h2>
    <p>${options.escapeHtml(message)}</p>
    <div class="line">
      <button id="ext-yes" type="button">Confirm</button>
      <button id="ext-no" type="button">Reject</button>
      <button id="ext-cancel" type="button">Cancel</button>
    </div>
  `;

  options.expectElement<HTMLButtonElement>("ext-yes").addEventListener("click", () => {
    post(options, requestId, true);
  });
  options.expectElement<HTMLButtonElement>("ext-no").addEventListener("click", () => {
    post(options, requestId, false);
  });
  options.expectElement<HTMLButtonElement>("ext-cancel").addEventListener("click", () => {
    post(options, requestId, null);
  });
}

function renderInputUi(
  options: ExtensionUiRendererOptions,
  requestId: string,
  titleText: string,
  data: Record<string, unknown>,
): void {
  const placeholder = readString(data.placeholder) ?? "";
  const prefill = readString(data.prefill) ?? "";

  options.panel.innerHTML = `
    <h2>${options.escapeHtml(titleText)}</h2>
    <textarea id="ext-input" rows="6" placeholder="${options.escapeHtml(placeholder)}">${options.escapeHtml(prefill)}</textarea>
    <div class="line">
      <button id="ext-submit" type="button">Submit</button>
      <button id="ext-cancel" type="button">Cancel</button>
    </div>
  `;

  bindExtensionUiButtons(options, requestId, () => {
    const input = options.expectElement<HTMLTextAreaElement>("ext-input");
    return input.value;
  });
}

function bindExtensionUiButtons(
  options: ExtensionUiRendererOptions,
  requestId: string,
  readValue: () => string,
): void {
  options.expectElement<HTMLButtonElement>("ext-submit").addEventListener("click", () => {
    post(options, requestId, readValue());
  });
  options.expectElement<HTMLButtonElement>("ext-cancel").addEventListener("click", () => {
    post(options, requestId, null);
  });
}

function post(options: ExtensionUiRendererOptions, requestId: string, payload: unknown): void {
  options.postResponse(requestId, payload);
  options.panel.classList.add("hidden");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
