// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { renderCommandPaletteItems } from "../../../src/view/webview/command-palette-dom.ts";

describe("command palette dom", () => {
  it("renders command rows and routes clicks back to the caller", () => {
    document.body.innerHTML = `<div id="list"></div>`;
    const list = document.getElementById("list") as HTMLElement;
    const applyCommand = vi.fn();

    renderCommandPaletteItems(
      list,
      [
        {
          id: "builtin:compact",
          name: "compact",
          description: "Compact session",
          aliases: [],
          source: "builtin",
        },
        {
          id: "extension:cg-status",
          name: "cg-status",
          description: "Show CodeGraph status",
          aliases: [],
          source: "extension",
          sourceBadge: "[u]",
        },
      ],
      1,
      applyCommand,
    );

    const rows = list.querySelectorAll<HTMLButtonElement>(".command-palette-item");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.classList.contains("is-selected")).toBe(true);
    expect(rows[1]?.textContent).toContain("cg-status");
    expect(rows[1]?.textContent).toContain("[u]");
    expect(rows[1]?.textContent).toContain("Show CodeGraph status");

    rows[0]?.click();
    expect(applyCommand).toHaveBeenCalledWith("compact");
  });
});
