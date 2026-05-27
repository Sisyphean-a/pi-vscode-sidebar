import {
  filterSidebarCommands,
  isExactSidebarCommandMatch,
  type SidebarCommandLocale,
  type SidebarCommandDefinition,
} from "../../shared/sidebar-commands.ts";
import { renderCommandPaletteItems } from "./command-palette-dom.ts";

interface CommandPaletteOptions {
  applyCommand(name: string): void;
  locale: SidebarCommandLocale;
  panel: HTMLElement;
  list: HTMLElement;
}

export interface CommandPalette {
  applySelection(value: string): boolean;
  hide(): void;
  isVisible(): boolean;
  moveSelection(offset: number): boolean;
  setDynamicCommands(commands: readonly SidebarCommandDefinition[]): void;
  update(value: string): void;
}

export function createCommandPalette(options: CommandPaletteOptions): CommandPalette {
  let dynamicCommands: readonly SidebarCommandDefinition[] = [];
  let selectedIndex = 0;
  let visibleItems: SidebarCommandDefinition[] = [];

  return {
    applySelection(value) {
      const selected = visibleItems[selectedIndex];
      if (!selected) return false;
      const normalizedValue = value.trim();
      const exactMatch = isExactSidebarCommandMatch(
        normalizedValue,
        options.locale,
        dynamicCommands,
      );
      if (exactMatch) return true;
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
      renderCommandPaletteItems(options.list, visibleItems, selectedIndex, options.applyCommand);
      return true;
    },
    setDynamicCommands(commands) {
      dynamicCommands = [...commands];
    },
    update(value) {
      const query = readCommandQuery(value);
      if (query === undefined) {
        this.hide();
        return;
      }
      visibleItems = filterSidebarCommands(query, options.locale, dynamicCommands);
      selectedIndex = 0;
      renderCommandPaletteItems(options.list, visibleItems, selectedIndex, options.applyCommand);
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
