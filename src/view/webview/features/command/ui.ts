import type { CommandResult, CommandUiRequest } from "../../../protocol.ts";
import { h } from "preact";
import { resolveCommandUiKeyAction } from "./ui-actions.ts";
import {
  clearCommandUiState,
  createCommandUiState,
  readCommandUiSelectionPayload,
  setCommandUiRequest,
} from "./ui-state.ts";
import type { CommandResultPort } from "../../app/view-ports.ts";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";

interface CommandUiOptions {
  result: CommandResultPort;
  view: PreactRenderPort;
  focusComposer(): void;
  postResponse(requestId: string, payload: unknown): void;
  setComposerValue(value: string): void;
}

export interface CommandUiController {
  applyResult(result: CommandResult): Promise<void>;
  clearResult(): void;
  handleKeydown(event: KeyboardEvent): boolean;
  isVisible(): boolean;
  renderRequest(request: CommandUiRequest): void;
}

export function createCommandUiController(options: CommandUiOptions): CommandUiController {
  const state = createCommandUiState();
  let renderedViewState: CommandUiViewState | undefined;

  const hidePanel = () => {
    clearCommandUiState(state);
    refreshView();
  };

  const postSelection = (index: number) => {
    const selection = readCommandUiSelectionPayload(state, index);
    if (!selection) return;
    options.postResponse(selection.requestId, selection.payload);
    hidePanel();
  };

  const refreshView = () => {
    const viewState = readCommandUiViewState(state, renderedViewState);
    if (!viewState) return;
    options.view.render(
      h(CommandUiPanel, {
        onSelect(index) {
          state.selectedIndex = index;
          postSelection(index);
        },
        request: viewState.request,
        selectedIndex: viewState.selectedIndex,
      }),
    );
    renderedViewState = viewState;
  };
  refreshView();

  return {
    async applyResult(result) {
      if (result.restoreInput) {
        options.setComposerValue(result.restoreInput);
        options.focusComposer();
      }
      if (result.copyText) {
        await navigator.clipboard?.writeText(result.copyText);
      }
      options.result.show(result);
      hidePanel();
    },
    clearResult() {
      options.result.clear();
    },
    handleKeydown(event) {
      const action = resolveCommandUiKeyAction(state, event.key, event.shiftKey);
      if (action.type === "ignore") return false;
      event.preventDefault();
      if (action.type === "rerender") {
        refreshView();
        return true;
      }
      if (action.type === "submit") {
        options.postResponse(action.requestId, action.payload);
        hidePanel();
        return true;
      }
      if (action.type === "cancel") {
        options.postResponse(action.requestId, null);
        hidePanel();
      }
      return true;
    },
    isVisible() {
      const request = state.currentRequest;
      return !!request && request.items.length > 0;
    },
    renderRequest(request) {
      setCommandUiRequest(state, request);
      refreshView();
      this.clearResult();
      options.focusComposer();
    },
  };
}

interface CommandUiViewState {
  request: CommandUiRequest | undefined;
  selectedIndex: number;
}

function readCommandUiViewState(
  state: ReturnType<typeof createCommandUiState>,
  previous: CommandUiViewState | undefined,
): CommandUiViewState | undefined {
  const nextViewState: CommandUiViewState = {
    request: state.currentRequest,
    selectedIndex: state.selectedIndex,
  };
  if (
    previous &&
    previous.request === nextViewState.request &&
    previous.selectedIndex === nextViewState.selectedIndex
  ) {
    return undefined;
  }
  return nextViewState;
}

interface CommandUiPanelProps {
  onSelect(index: number): void;
  request: CommandUiRequest | undefined;
  selectedIndex: number;
}

function CommandUiPanel(props: CommandUiPanelProps) {
  const request = props.request;
  if (!request || request.items.length === 0) return null;
  return h(
    "div",
    { class: "command-ui-panel" },
    h(
      "div",
      { class: "command-ui-list" },
      h(CommandUiItemList, {
        items: request.items,
        onSelect: props.onSelect,
        selectedIndex: props.selectedIndex,
      }),
    ),
  );
}

interface CommandUiItemListProps {
  items: ReadonlyArray<CommandUiRequest["items"][number]>;
  onSelect(index: number): void;
  selectedIndex: number;
}

function CommandUiItemList(props: CommandUiItemListProps) {
  return props.items.map((item, index) => {
    const className =
      index === props.selectedIndex
        ? item.active
          ? "command-ui-item is-active is-selected"
          : "command-ui-item is-selected"
        : item.active
          ? "command-ui-item is-active"
          : "command-ui-item";
    return h(
      "button",
      {
        class: className,
        "data-command-ui-item": item.id,
        onClick() {
          props.onSelect(index);
        },
        style: { "--command-depth": `${item.depth ?? 0}` } as Record<string, string>,
        type: "button",
      },
      item.label,
    );
  });
}
