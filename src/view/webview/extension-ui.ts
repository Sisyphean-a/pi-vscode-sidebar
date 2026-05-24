interface ExtensionUiRendererOptions {
  panel: HTMLElement;
  escapeHtml(text: string): string;
  expectElement<TElement extends HTMLElement>(id: string): TElement;
  postResponse(requestId: string, payload: unknown): void;
}

export function createExtensionUiRenderer(options: ExtensionUiRendererOptions) {
  return (data: Record<string, unknown>) => {
    const requestId = readString(data.id);
    const method = readString(data.method);
    if (!requestId || !method) return;

    options.panel.classList.remove("hidden");
    const titleText = readString(data.title) ?? "Input Required";
    if (method === "select") return renderSelectUi(options, requestId, titleText, data);
    if (method === "confirm") return renderConfirmUi(options, requestId, titleText, data);
    if (method === "input" || method === "editor")
      return renderInputUi(options, requestId, titleText, data);
    options.panel.classList.add("hidden");
  };
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
