import type { CommandResult, CommandUiItem } from "../protocol.ts";

export function applyCommandUiResult(resultElement: HTMLElement, result: CommandResult): void {
  resultElement.textContent = result.message ?? "";
  resultElement.dataset.status = result.status;
  resultElement.classList.toggle("hidden", !result.message);
}

export function clearCommandUiResult(resultElement: HTMLElement): void {
  resultElement.textContent = "";
  resultElement.classList.add("hidden");
  delete resultElement.dataset.status;
}

export function hideCommandUiPanel(panel: HTMLElement, list: HTMLElement): void {
  panel.classList.add("hidden");
  list.replaceChildren();
}

export function renderCommandUiItems(
  list: HTMLElement,
  items: CommandUiItem[],
  selectedIndex: number,
  onSelect: (index: number) => void,
): void {
  list.replaceChildren(
    ...items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-ui-item";
      if (item.active) button.classList.add("is-active");
      if (index === selectedIndex) button.classList.add("is-selected");
      button.style.setProperty("--command-depth", `${item.depth ?? 0}`);
      button.dataset.commandUiItem = item.id;
      button.textContent = item.label;
      button.addEventListener("click", () => {
        onSelect(index);
      });
      return button;
    }),
  );
}
