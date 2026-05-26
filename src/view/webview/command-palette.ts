import {
  filterSidebarCommands,
  type SidebarCommandDefinition,
} from "../../shared/sidebar-commands.ts";

interface CommandPaletteOptions {
  applyCommand(name: string): void;
  panel: HTMLElement;
  list: HTMLElement;
}

export interface CommandPalette {
  applySelection(value: string): boolean;
  hide(): void;
  isVisible(): boolean;
  moveSelection(offset: number): boolean;
  update(value: string): void;
}

export function createCommandPalette(options: CommandPaletteOptions): CommandPalette {
  let selectedIndex = 0;
  let visibleItems: SidebarCommandDefinition[] = [];

  return {
    applySelection(value) {
      const selected = visibleItems[selectedIndex];
      if (!selected) return false;
      const normalizedValue = value.trim();
      options.applyCommand(selected.name);
      return normalizedValue === `/${selected.name}`;
    },
    hide() {
      visibleItems = [];
      selectedIndex = 0;
      options.panel.classList.add("hidden");
      options.list.replaceChildren();
    },
    isVisible() {
      return !options.panel.classList.contains("hidden");
    },
    moveSelection(offset) {
      if (visibleItems.length === 0) return false;
      selectedIndex = (selectedIndex + offset + visibleItems.length) % visibleItems.length;
      renderCommandPalette(options.list, visibleItems, selectedIndex, options.applyCommand);
      return true;
    },
    update(value) {
      const query = readCommandQuery(value);
      if (query === undefined) {
        this.hide();
        return;
      }
      visibleItems = filterSidebarCommands(query);
      selectedIndex = 0;
      renderCommandPalette(options.list, visibleItems, selectedIndex, options.applyCommand);
      options.panel.classList.toggle("hidden", visibleItems.length === 0);
    },
  };
}

function readCommandQuery(value: string): string | undefined {
  const trimmedStart = value.trimStart();
  if (!trimmedStart.startsWith("/")) return undefined;
  const body = trimmedStart.slice(1);
  const spaceIndex = body.indexOf(" ");
  if (spaceIndex !== -1) return undefined;
  return body.trim();
}

function renderCommandPalette(
  list: HTMLElement,
  items: SidebarCommandDefinition[],
  selectedIndex: number,
  applyCommand: (name: string) => void,
): void {
  list.replaceChildren(
    ...items.map((item, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "command-palette-item";
      if (index === selectedIndex) row.classList.add("is-selected");
      row.textContent = `/${item.name}`;
      row.addEventListener("click", () => {
        applyCommand(item.name);
      });
      return row;
    }),
  );
}
