interface SelectTemplateRequest {
  options: string[];
  titleText: string;
}

interface ConfirmTemplateRequest {
  message: string;
  titleText: string;
}

interface InputTemplateRequest {
  placeholder: string;
  prefill: string;
  titleText: string;
}

type EscapeHtml = (text: string) => string;

export function renderConfirmTemplate(
  request: ConfirmTemplateRequest,
  escapeHtml: EscapeHtml,
): string {
  return `
    <h2>${escapeHtml(request.titleText)}</h2>
    <p>${escapeHtml(request.message)}</p>
    <div class="line">
      <button id="ext-yes" type="button">确认</button>
      <button id="ext-no" type="button">拒绝</button>
      <button id="ext-cancel" type="button">取消</button>
    </div>
  `;
}

export function renderInputTemplate(request: InputTemplateRequest, escapeHtml: EscapeHtml): string {
  return `
    <h2>${escapeHtml(request.titleText)}</h2>
    <textarea id="ext-input" rows="6" placeholder="${escapeHtml(request.placeholder)}">${escapeHtml(request.prefill)}</textarea>
    <div class="line">
      <button id="ext-submit" type="button">提交</button>
      <button id="ext-cancel" type="button">取消</button>
    </div>
  `;
}

export function renderSelectTemplate(
  request: SelectTemplateRequest,
  escapeHtml: EscapeHtml,
): string {
  const optionHtml = request.options
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");

  return `
    <h2>${escapeHtml(request.titleText)}</h2>
    <select id="ext-select">${optionHtml}</select>
    <div class="line">
      <button id="ext-submit" type="button">提交</button>
      <button id="ext-cancel" type="button">取消</button>
    </div>
  `;
}

export function renderSetEditorTextTemplate(text: string, escapeHtml: EscapeHtml): string {
  return `
    <h2>编辑输入内容</h2>
    <textarea id="ext-editor-text" rows="6">${escapeHtml(text)}</textarea>
    <div class="line">
      <button id="ext-apply-editor-text" type="button">应用</button>
      <button id="ext-cancel-editor-text" type="button">取消</button>
    </div>
  `;
}
