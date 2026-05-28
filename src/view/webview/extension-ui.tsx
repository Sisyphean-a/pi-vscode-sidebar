import { effect, signal } from "@preact/signals";
import { h, render } from "preact";
import { resolveExtensionUiRequest, type ExtensionUiRequest } from "./extension-ui-state.ts";

interface ExtensionUiRendererOptions {
  panel: HTMLElement;
  postResponse(requestId: string, payload: unknown): void;
  updateStatus(statusKey: string, statusText?: string): void;
  updateTitle(nextTitle: string): void;
  setEditorText(text: string): void;
  queueNotice(message: string): void;
}

type InteractiveRequest = Extract<
  ExtensionUiRequest,
  { type: "select" | "confirm" | "input" | "set_editor_text" }
>;

interface ExtensionUiPanelProps {
  editorDraft: string;
  inputDraft: string;
  request: InteractiveRequest | null;
  selectDraft: string;
  setEditorDraft(value: string): void;
  setInputDraft(value: string): void;
  setSelectDraft(value: string): void;
  onCancel(): void;
  onConfirm(value: boolean | string | null): void;
}

export function createExtensionUiRenderer(options: ExtensionUiRendererOptions) {
  const activeRequestSignal = signal<InteractiveRequest | null>(null);
  const selectDraftSignal = signal("");
  const inputDraftSignal = signal("");
  const editorDraftSignal = signal("");

  effect(() => {
    render(
      h(ExtensionUiPanel, {
        editorDraft: editorDraftSignal.value,
        inputDraft: inputDraftSignal.value,
        onCancel: hidePanel,
        onConfirm(value) {
          const request = activeRequestSignal.value;
          if (!request) return;
          if (request.type === "set_editor_text" && typeof value === "string") {
            options.setEditorText(value);
            options.queueNotice("输入内容已更新。");
            hidePanel();
            return;
          }
          if (request.type !== "set_editor_text") {
            options.postResponse(request.requestId, value);
          }
          hidePanel();
        },
        request: activeRequestSignal.value,
        selectDraft: selectDraftSignal.value,
        setEditorDraft(value) {
          editorDraftSignal.value = value;
        },
        setInputDraft(value) {
          inputDraftSignal.value = value;
        },
        setSelectDraft(value) {
          selectDraftSignal.value = value;
        },
      }),
      options.panel,
    );
  });

  return (data: Record<string, unknown>) => {
    const request = resolveExtensionUiRequest(data);
    if (!request) return;

    if (request.type === "select") {
      selectDraftSignal.value = request.options[0] ?? "";
      showPanel(request);
      return;
    }
    if (request.type === "confirm") {
      showPanel(request);
      return;
    }
    if (request.type === "input") {
      inputDraftSignal.value = request.prefill;
      showPanel(request);
      return;
    }
    if (request.type === "set_editor_text") {
      editorDraftSignal.value = request.text;
      showPanel(request);
      return;
    }
    if (request.type === "notify") {
      options.queueNotice(request.noticeMessage);
      hidePanel();
      return;
    }
    if (request.type === "status") {
      options.updateStatus(request.statusKey, request.statusText);
      hidePanel();
      return;
    }
    if (request.type === "title") {
      if (request.title) {
        options.updateTitle(request.title);
      }
      hidePanel();
      return;
    }

    hidePanel();
  };

  function showPanel(request: InteractiveRequest): void {
    activeRequestSignal.value = request;
    options.panel.classList.remove("hidden");
  }

  function hidePanel(): void {
    activeRequestSignal.value = null;
    options.panel.classList.add("hidden");
  }
}

function ExtensionUiPanel(props: ExtensionUiPanelProps) {
  const request = props.request;
  if (!request) return null;

  if (request.type === "select") {
    return (
      <>
        <h2>{request.titleText}</h2>
        <select
          id="ext-select"
          value={props.selectDraft}
          onInput={(event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLSelectElement)) return;
            props.setSelectDraft(target.value);
          }}
        >
          {request.options.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div class="line">
          <button
            id="ext-submit"
            type="button"
            onClick={() => props.onConfirm(readSelectValue("ext-select"))}
          >
            提交
          </button>
          <button id="ext-cancel" type="button" onClick={props.onCancel}>
            取消
          </button>
        </div>
      </>
    );
  }

  if (request.type === "confirm") {
    return (
      <>
        <h2>{request.titleText}</h2>
        <p>{request.message}</p>
        <div class="line">
          <button id="ext-yes" type="button" onClick={() => props.onConfirm(true)}>
            确认
          </button>
          <button id="ext-no" type="button" onClick={() => props.onConfirm(false)}>
            拒绝
          </button>
          <button id="ext-cancel" type="button" onClick={() => props.onConfirm(null)}>
            取消
          </button>
        </div>
      </>
    );
  }

  if (request.type === "input") {
    return (
      <>
        <h2>{request.titleText}</h2>
        <textarea
          id="ext-input"
          rows={6}
          placeholder={request.placeholder}
          value={props.inputDraft}
          onInput={(event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLTextAreaElement)) return;
            props.setInputDraft(target.value);
          }}
        />
        <div class="line">
          <button
            id="ext-submit"
            type="button"
            onClick={() => props.onConfirm(readTextareaValue("ext-input"))}
          >
            提交
          </button>
          <button id="ext-cancel" type="button" onClick={() => props.onConfirm(null)}>
            取消
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>编辑输入内容</h2>
      <textarea
        id="ext-editor-text"
        rows={6}
        value={props.editorDraft}
        onInput={(event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLTextAreaElement)) return;
          props.setEditorDraft(target.value);
        }}
      />
      <div class="line">
        <button
          id="ext-apply-editor-text"
          type="button"
          onClick={() => props.onConfirm(readTextareaValue("ext-editor-text"))}
        >
          应用
        </button>
        <button id="ext-cancel-editor-text" type="button" onClick={props.onCancel}>
          取消
        </button>
      </div>
    </>
  );
}

function readTextareaValue(id: string): string {
  const element = document.getElementById(id);
  return element instanceof HTMLTextAreaElement ? element.value : "";
}

function readSelectValue(id: string): string {
  const element = document.getElementById(id);
  return element instanceof HTMLSelectElement ? element.value : "";
}
