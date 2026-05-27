// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { renderCommandUiItems } from "../../../src/view/webview/command-ui-dom.ts";

describe("command ui dom", () => {
  it("renders command items and routes clicks back to the caller", () => {
    document.body.innerHTML = `<div id="list"></div>`;
    const list = document.getElementById("list") as HTMLElement;
    const onSelect = vi.fn();

    renderCommandUiItems(
      list,
      [
        { id: "node-1", label: "节点 1", active: true, depth: 1 },
        { id: "node-2", label: "节点 2" },
      ],
      1,
      onSelect,
    );

    const buttons = list.querySelectorAll<HTMLButtonElement>(".command-ui-item");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.classList.contains("is-active")).toBe(true);
    expect(buttons[1]?.classList.contains("is-selected")).toBe(true);
    expect(buttons[0]?.style.getPropertyValue("--command-depth")).toBe("1");

    buttons[0]?.click();
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
