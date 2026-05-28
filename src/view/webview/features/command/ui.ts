import type { CommandResult, CommandUiRequest } from "../../../protocol.ts";
import { h, render } from "preact";
import { resolveCommandUiKeyAction } from "./ui-actions.ts";
import {
  clearCommandUiState,
  createCommandUiState,
  readCommandUiSelectionPayload,
  setCommandUiRequest,
} from "./ui-state.ts";

interface CommandUiOptions {
  panel: HTMLElement;
  list: HTMLElement;
  result: HTMLElement;
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

  function hidePanel(): void {
    clearCommandUiState(state);
    hideCommandUiPanel(options.panel, options.list);
  }

  function postSelection(index: number): void {
    const selection = readCommandUiSelectionPayload(state, index);
    if (!selection) return;
    options.postResponse(selection.requestId, selection.payload);
    hidePanel();
  }

  function renderItems(): void {
    const request = state.currentRequest;
    if (!request) {
      clearCommandUiItems(options.list);
      return;
    }
    renderCommandUiItems(options.list, request.items, state.selectedIndex, (index) => {
      state.selectedIndex = index;
      postSelection(index);
    });
  }

  return {
    async applyResult(result) {
      if (result.restoreInput) {
        options.setComposerValue(result.restoreInput);
        options.focusComposer();
      }
      if (result.copyText) {
        await navigator.clipboard?.writeText(result.copyText);
      }
      applyCommandUiResult(options.result, result);
      hidePanel();
    },
    clearResult() {
      clearCommandUiResult(options.result);
    },
    handleKeydown(event) {
      const action = resolveCommandUiKeyAction(state, event.key, event.shiftKey);
      if (action.type === "ignore") return false;
      event.preventDefault();
      if (action.type === "rerender") {
        renderItems();
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
      return !!state.currentRequest && !options.panel.classList.contains("hidden");
    },
    renderRequest(request) {
      setCommandUiRequest(state, request);
      renderItems();
      options.panel.classList.toggle("hidden", request.items.length === 0);
      this.clearResult();
      options.focusComposer();
    },
  };
}

function applyCommandUiResult(resultElement: HTMLElement, result: CommandResult): void {
  resultElement.textContent = result.message ?? "";
  resultElement.dataset.status = result.status;
  resultElement.classList.toggle("hidden", !result.message);
}

function clearCommandUiResult(resultElement: HTMLElement): void {
  resultElement.textContent = "";
  resultElement.classList.add("hidden");
  delete resultElement.dataset.status;
}

function clearCommandUiItems(list: HTMLElement): void {
  render(null, list);
}

function hideCommandUiPanel(panel: HTMLElement, list: HTMLElement): void {
  panel.classList.add("hidden");
  clearCommandUiItems(list);
}

function renderCommandUiItems(
  list: HTMLElement,
  items: ReadonlyArray<CommandUiRequest["items"][number]>,
  selectedIndex: number,
  onSelect: (index: number) => void,
): void {
  render(
    h(CommandUiItemList, {
      items,
      onSelect,
      selectedIndex,
    }),
    list,
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
