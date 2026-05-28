import { batch, effect, signal } from "@preact/signals";
import { h, render } from "preact";
import {
  filterSidebarCommands,
  isExactSidebarCommandMatch,
  type SidebarCommandDefinition,
  type SidebarCommandLocale,
} from "../../../../shared/sidebar-commands.ts";

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
  const dynamicCommandsSignal = signal<readonly SidebarCommandDefinition[]>([]);
  const selectedIndexSignal = signal(0);
  const visibleItemsSignal = signal<SidebarCommandDefinition[]>([]);

  effect(() => {
    const visibleItems = visibleItemsSignal.value;
    if (visibleItems.length === 0) {
      clearCommandPaletteItems(options.list);
      options.panel.classList.add("hidden");
      return;
    }
    renderCommandPaletteItems(
      options.list,
      visibleItems,
      selectedIndexSignal.value,
      options.applyCommand,
    );
    options.panel.classList.remove("hidden");
  });

  return {
    applySelection(value) {
      const visibleItems = visibleItemsSignal.value;
      const selected = visibleItems[selectedIndexSignal.value];
      if (!selected) return false;
      const normalizedValue = value.trim();
      const exactMatch = isExactSidebarCommandMatch(
        normalizedValue,
        options.locale,
        dynamicCommandsSignal.value,
      );
      if (exactMatch) return true;
      options.applyCommand(selected.name);
      return normalizedValue === `/${selected.name}`;
    },
    hide() {
      batch(() => {
        visibleItemsSignal.value = [];
        selectedIndexSignal.value = 0;
      });
    },
    isVisible() {
      return !options.panel.classList.contains("hidden");
    },
    moveSelection(offset) {
      const visibleItems = visibleItemsSignal.value;
      if (visibleItems.length === 0) return false;
      selectedIndexSignal.value =
        (selectedIndexSignal.value + offset + visibleItems.length) % visibleItems.length;
      return true;
    },
    setDynamicCommands(commands) {
      dynamicCommandsSignal.value = [...commands];
    },
    update(value) {
      const query = readCommandQuery(value);
      if (query === undefined) {
        this.hide();
        return;
      }
      batch(() => {
        visibleItemsSignal.value = filterSidebarCommands(
          query,
          options.locale,
          dynamicCommandsSignal.value,
        );
        selectedIndexSignal.value = 0;
      });
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

function clearCommandPaletteItems(list: HTMLElement): void {
  render(null, list);
}

function renderCommandPaletteItems(
  list: HTMLElement,
  items: SidebarCommandDefinition[],
  selectedIndex: number,
  applyCommand: (name: string) => void,
): void {
  render(
    h(CommandPaletteItemList, {
      applyCommand,
      items,
      selectedIndex,
    }),
    list,
  );
}

interface CommandPaletteItemListProps {
  applyCommand(name: string): void;
  items: SidebarCommandDefinition[];
  selectedIndex: number;
}

function CommandPaletteItemList(props: CommandPaletteItemListProps) {
  return props.items.map((item, index) => {
    const className =
      index === props.selectedIndex ? "command-palette-item is-selected" : "command-palette-item";
    return h(
      "button",
      {
        class: className,
        key: `${item.id}:${item.name}`,
        onClick() {
          props.applyCommand(item.name);
        },
        type: "button",
      },
      h(
        "div",
        { class: "command-palette-item-primary" },
        h("span", { class: "command-palette-item-name" }, item.name),
        item.sourceBadge
          ? h("span", { class: "command-palette-item-badge" }, item.sourceBadge)
          : null,
      ),
      item.description
        ? h("span", { class: "command-palette-item-description" }, item.description)
        : null,
    );
  });
}
