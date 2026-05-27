import type { CommandResult, CommandUiRequest } from "../protocol.ts";
import { resolveCommandUiKeyAction } from "./command-ui-actions.ts";
import {
  applyCommandUiResult,
  clearCommandUiResult,
  hideCommandUiPanel,
  renderCommandUiItems,
} from "./command-ui-dom.ts";
import {
  clearCommandUiState,
  createCommandUiState,
  readCommandUiSelectionPayload,
  setCommandUiRequest,
} from "./command-ui-state.ts";

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
      options.list.replaceChildren();
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
