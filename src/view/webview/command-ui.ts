import type { CommandResult, CommandUiRequest } from "../protocol.ts";

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
  let currentRequest: CommandUiRequest | undefined;
  let selectedIndex = 0;

  function hidePanel(): void {
    currentRequest = undefined;
    selectedIndex = 0;
    options.panel.classList.add("hidden");
    options.list.replaceChildren();
  }

  function postSelection(index: number): void {
    const request = currentRequest;
    if (!request) return;
    const item = request.items[index];
    if (!item) return;
    options.postResponse(request.id, item.payload ?? { selectedId: item.id });
    hidePanel();
  }

  function renderItems(): void {
    const request = currentRequest;
    if (!request) {
      options.list.replaceChildren();
      return;
    }
    options.list.replaceChildren(
      ...request.items.map((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "command-ui-item";
        if (item.active) button.classList.add("is-active");
        if (index === selectedIndex) button.classList.add("is-selected");
        button.style.setProperty("--command-depth", `${item.depth ?? 0}`);
        button.dataset.commandUiItem = item.id;
        button.textContent = item.label;
        button.addEventListener("click", () => {
          selectedIndex = index;
          postSelection(index);
        });
        return button;
      }),
    );
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
      options.result.textContent = result.message ?? "";
      options.result.dataset.status = result.status;
      options.result.classList.toggle("hidden", !result.message);
      hidePanel();
    },
    clearResult() {
      options.result.textContent = "";
      options.result.classList.add("hidden");
      delete options.result.dataset.status;
    },
    handleKeydown(event) {
      if (!currentRequest) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (currentRequest.items.length === 0) return true;
        selectedIndex = (selectedIndex + 1) % currentRequest.items.length;
        renderItems();
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (currentRequest.items.length === 0) return true;
        selectedIndex =
          (selectedIndex - 1 + currentRequest.items.length) % currentRequest.items.length;
        renderItems();
        return true;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        postSelection(selectedIndex);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        options.postResponse(currentRequest.id, null);
        hidePanel();
        return true;
      }
      return false;
    },
    isVisible() {
      return !!currentRequest && !options.panel.classList.contains("hidden");
    },
    renderRequest(request) {
      currentRequest = request;
      selectedIndex = request.items.findIndex((item) => item.active);
      if (selectedIndex < 0) selectedIndex = 0;
      renderItems();
      options.panel.classList.toggle("hidden", request.items.length === 0);
      this.clearResult();
      options.focusComposer();
    },
  };
}
