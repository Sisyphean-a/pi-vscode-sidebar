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
      const titleText = readString(data.title) ?? "需要选择";
      options.panel.classList.remove("hidden");
      renderSelectUi(options, requestId, titleText, data);
      return;
    }
    if (method === "confirm") {
      if (!requestId) return;
      const titleText = readString(data.title) ?? "请确认";
      options.panel.classList.remove("hidden");
      renderConfirmUi(options, requestId, titleText, data);
      return;
    }
    if (method === "input" || method === "editor") {
      if (!requestId) return;
      const titleText = readString(data.title) ?? "请输入";
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
  const message = readString(data.message) ?? "收到通知。";
  const level = readString(data.level) ?? readString(data.type) ?? "info";
  const levelLabel = mapNoticeLevel(level);
  options.queueNotice(`[${levelLabel}] ${message}`);
  options.panel.innerHTML = `
    <h2>通知</h2>
    <p>${options.escapeHtml(message)}</p>
    <p><small>级别：${options.escapeHtml(levelLabel)}</small></p>
    <div class="line">
      <button id="ext-dismiss" type="button">关闭</button>
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
    <h2>编辑输入内容</h2>
    <textarea id="ext-editor-text" rows="6">${options.escapeHtml(text)}</textarea>
    <div class="line">
      <button id="ext-apply-editor-text" type="button">应用</button>
      <button id="ext-cancel-editor-text" type="button">取消</button>
    </div>
  `;
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
      <button id="ext-submit" type="button">提交</button>
      <button id="ext-cancel" type="button">取消</button>
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
      <button id="ext-yes" type="button">确认</button>
      <button id="ext-no" type="button">拒绝</button>
      <button id="ext-cancel" type="button">取消</button>
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
      <button id="ext-submit" type="button">提交</button>
      <button id="ext-cancel" type="button">取消</button>
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

function mapNoticeLevel(level: string): string {
  if (level === "info") return "信息";
  if (level === "warning" || level === "warn") return "警告";
  if (level === "error") return "错误";
  if (level === "success") return "成功";
  return "通知";
}
