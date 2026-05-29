import { h } from "preact";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";
import { resolveExtensionUiRequest, type ExtensionUiRequest } from "./state.ts";

interface ExtensionUiRendererOptions {
  panelVisibility: ExtensionUiPanelVisibilityPort;
  view: PreactRenderPort;
  postResponse(requestId: string, payload: unknown): void;
  updateStatus(statusKey: string, statusText?: string): void;
  updateTitle(nextTitle: string): void;
  setEditorText(text: string): void;
  queueNotice(message: string): void;
}

export interface ExtensionUiPanelVisibilityPort {
  setHidden(hidden: boolean): void;
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

export interface ExtensionUiController {
  handleRequest(data: Record<string, unknown>): void;
  hide(): void;
  isVisible(): boolean;
}

interface ExtensionUiViewState {
  editorDraft: string;
  inputDraft: string;
  request: InteractiveRequest | null;
  selectDraft: string;
}

export function createExtensionUiRenderer(options: ExtensionUiRendererOptions): ExtensionUiController {
  let viewState: ExtensionUiViewState = {
    editorDraft: "",
    inputDraft: "",
    request: null,
    selectDraft: "",
  };
  const sync = () => {
    options.panelVisibility.setHidden(viewState.request === null);
    options.view.render(
      h(ExtensionUiPanel, {
        editorDraft: viewState.editorDraft,
        inputDraft: viewState.inputDraft,
        onCancel: hidePanel,
        onConfirm: confirmRequest,
        request: viewState.request,
        selectDraft: viewState.selectDraft,
        setEditorDraft(value) {
          updateViewState({ editorDraft: value });
        },
        setInputDraft(value) {
          updateViewState({ inputDraft: value });
        },
        setSelectDraft(value) {
          updateViewState({ selectDraft: value });
        },
      }),
    );
  };
  sync();

  return {
    handleRequest(data) {
      const request = resolveExtensionUiRequest(data);
      if (!request) return;

      if (request.type === "select") {
        showPanel(request, { selectDraft: request.options[0] ?? "" });
        return;
      }
      if (request.type === "confirm") {
        showPanel(request);
        return;
      }
      if (request.type === "input") {
        showPanel(request, { inputDraft: request.prefill });
        return;
      }
      if (request.type === "set_editor_text") {
        showPanel(request, { editorDraft: request.text });
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
    },
    hide: hidePanel,
    isVisible() {
      return viewState.request !== null;
    },
  };

  function confirmRequest(value: boolean | string | null): void {
    const request = viewState.request;
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
  }

  function showPanel(
    request: InteractiveRequest,
    draftPatch: Partial<Pick<ExtensionUiViewState, "editorDraft" | "inputDraft" | "selectDraft">> = {},
  ): void {
    updateViewState({ ...draftPatch, request });
  }

  function hidePanel(): void {
    updateViewState({ request: null });
  }

  function updateViewState(patch: Partial<ExtensionUiViewState>): void {
    const nextViewState: ExtensionUiViewState = {
      ...viewState,
      ...patch,
    };
    if (isExtensionUiViewStateEqual(viewState, nextViewState)) return;
    viewState = nextViewState;
    sync();
  }
}

function isExtensionUiViewStateEqual(
  left: ExtensionUiViewState,
  right: ExtensionUiViewState,
): boolean {
  return (
    left.request === right.request &&
    left.selectDraft === right.selectDraft &&
    left.inputDraft === right.inputDraft &&
    left.editorDraft === right.editorDraft
  );
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
            onClick={() => props.onConfirm(props.selectDraft)}
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
            onClick={() => props.onConfirm(props.inputDraft)}
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
          onClick={() => props.onConfirm(props.editorDraft)}
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
