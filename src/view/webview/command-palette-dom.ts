import type { SidebarCommandDefinition } from "../../shared/sidebar-commands.ts";

export function renderCommandPaletteItems(
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
      const primary = document.createElement("div");
      primary.className = "command-palette-item-primary";

      const name = document.createElement("span");
      name.className = "command-palette-item-name";
      name.textContent = item.name;
      primary.append(name);

      if (item.sourceBadge) {
        const badge = document.createElement("span");
        badge.className = "command-palette-item-badge";
        badge.textContent = item.sourceBadge;
        primary.append(badge);
      }

      row.append(primary);

      if (item.description) {
        const description = document.createElement("span");
        description.className = "command-palette-item-description";
        description.textContent = item.description;
        row.append(description);
      }

      row.addEventListener("click", () => {
        applyCommand(item.name);
      });
      return row;
    }),
  );
}
