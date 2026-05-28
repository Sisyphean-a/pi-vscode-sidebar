// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import type { SidebarCommandDefinition } from "../../../src/shared/sidebar-commands.ts";
import { createCommandPalette } from "../../../src/view/webview/features/command/palette.ts";

describe("command palette", () => {
  it("updates visible items and applies selected command unless exact match", () => {
    const harness = createHarness();
    const palette = createCommandPalette(harness.options);
    palette.setDynamicCommands(createDynamicCommands());

    palette.update("/zz-d");
    expect(palette.isVisible()).toBe(true);
    expect(harness.list.querySelectorAll(".command-palette-item")).toHaveLength(2);
    expect(palette.applySelection("/zz-d")).toBe(false);
    expect(harness.applyCommand).toHaveBeenCalledWith("zz-dyn-a");

    harness.applyCommand.mockClear();
    palette.update("/zz-dyn-a");
    expect(palette.applySelection("/zz-dyn-a")).toBe(true);
    expect(harness.applyCommand).not.toHaveBeenCalled();
  });

  it("moves selection with wrap-around and hides for non-command input", () => {
    const harness = createHarness();
    const palette = createCommandPalette(harness.options);
    palette.setDynamicCommands(createDynamicCommands());

    palette.update("/zz-d");
    expect(palette.moveSelection(1)).toBe(true);
    expect(palette.moveSelection(1)).toBe(true);

    palette.update("hello");
    expect(palette.isVisible()).toBe(false);
    expect(harness.list.querySelectorAll(".command-palette-item")).toHaveLength(0);
    expect(palette.moveSelection(1)).toBe(false);
  });
});

function createHarness() {
  document.body.innerHTML = `
    <section id="panel" class="hidden">
      <div id="list"></div>
    </section>
  `;
  const panel = expectElement<HTMLElement>("panel");
  const list = expectElement<HTMLElement>("list");
  const applyCommand = vi.fn();

  return {
    applyCommand,
    list,
    options: {
      applyCommand,
      list,
      locale: "zh" as const,
      panel,
    },
    panel,
  };
}

function createDynamicCommands(): SidebarCommandDefinition[] {
  return [
    {
      id: "zz-a",
      name: "zz-dyn-a",
      source: "builtin",
      aliases: ["zz-dyn-a"],
    },
    {
      id: "zz-b",
      name: "zz-dyn-b",
      source: "builtin",
      aliases: ["zz-dyn-b"],
    },
  ];
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
