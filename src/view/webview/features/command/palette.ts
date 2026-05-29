import { h } from "preact";
import {
  filterSidebarCommands,
  isExactSidebarCommandMatch,
  type SidebarCommandDefinition,
  type SidebarCommandLocale,
} from "../../../../shared/sidebar-commands.ts";
import type { PreactRenderPort } from "../../ui/preact-render-port.ts";

interface CommandPaletteOptions {
  applyCommand(name: string): void;
  locale: SidebarCommandLocale;
  view: PreactRenderPort;
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
  const state: CommandPaletteState = {
    dynamicCommands: [],
    selectedIndex: 0,
    visibleItems: [],
  };
  let renderedViewState: CommandPaletteViewState | undefined;
  const refreshView = () => {
    const viewState = readCommandPaletteViewState(state, renderedViewState);
    if (!viewState) return;
    options.view.render(
      h(CommandPalettePanel, {
        applyCommand: options.applyCommand,
        items: viewState.visibleItems,
        selectedIndex: viewState.selectedIndex,
      }),
    );
    renderedViewState = viewState;
  };
  refreshView();

  return {
    applySelection(value) {
      const selected = state.visibleItems[state.selectedIndex];
      if (!selected) return false;
      const normalizedValue = value.trim();
      const exactMatch = isExactSidebarCommandMatch(
        normalizedValue,
        options.locale,
        state.dynamicCommands,
      );
      if (exactMatch) return true;
      options.applyCommand(selected.name);
      return normalizedValue === `/${selected.name}`;
    },
    hide() {
      state.visibleItems = [];
      state.selectedIndex = 0;
      refreshView();
    },
    isVisible() {
      return state.visibleItems.length > 0;
    },
    moveSelection(offset) {
      if (state.visibleItems.length === 0) return false;
      state.selectedIndex =
        (state.selectedIndex + offset + state.visibleItems.length) % state.visibleItems.length;
      refreshView();
      return true;
    },
    setDynamicCommands(commands) {
      state.dynamicCommands = [...commands];
    },
    update(value) {
      const query = readCommandQuery(value);
      if (query === undefined) {
        this.hide();
        return;
      }
      state.visibleItems = filterSidebarCommands(query, options.locale, state.dynamicCommands);
      state.selectedIndex = 0;
      refreshView();
    },
  };
}

interface CommandPaletteState {
  dynamicCommands: readonly SidebarCommandDefinition[];
  selectedIndex: number;
  visibleItems: SidebarCommandDefinition[];
}

interface CommandPaletteViewState {
  selectedIndex: number;
  visibleItems: SidebarCommandDefinition[];
}

function readCommandPaletteViewState(
  state: CommandPaletteState,
  previous: CommandPaletteViewState | undefined,
): CommandPaletteViewState | undefined {
  const nextViewState: CommandPaletteViewState = {
    selectedIndex: state.selectedIndex,
    visibleItems: [...state.visibleItems],
  };
  if (!previous) return nextViewState;
  if (
    previous.selectedIndex === nextViewState.selectedIndex &&
    isCommandListEqual(previous.visibleItems, nextViewState.visibleItems)
  ) {
    return undefined;
  }
  return nextViewState;
}

function isCommandListEqual(
  left: readonly SidebarCommandDefinition[],
  right: readonly SidebarCommandDefinition[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (!leftItem || !rightItem) return false;
    if (leftItem.id !== rightItem.id || leftItem.name !== rightItem.name) return false;
  }
  return true;
}

function readCommandQuery(value: string): string | undefined {
  const trimmedStart = value.trimStart();
  if (!trimmedStart.startsWith("/")) return undefined;
  const body = trimmedStart.slice(1);
  const spaceIndex = body.indexOf(" ");
  if (spaceIndex !== -1) return undefined;
  return body.trim();
}

interface CommandPalettePanelProps {
  applyCommand(name: string): void;
  items: SidebarCommandDefinition[];
  selectedIndex: number;
}

function CommandPalettePanel(props: CommandPalettePanelProps) {
  if (props.items.length === 0) return null;
  return h(
    "div",
    { class: "command-palette-panel" },
    h(
      "div",
      { class: "command-palette-list" },
      h(CommandPaletteItemList, {
        applyCommand: props.applyCommand,
        items: props.items,
        selectedIndex: props.selectedIndex,
      }),
    ),
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
