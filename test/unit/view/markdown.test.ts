// @vitest-environment jsdom
import { h, render } from "preact";
import { describe, expect, it, vi } from "vitest";
import {
  renderAssistantMarkdown,
  renderPlainTextWithReferences,
} from "../../../src/view/webview/markdown.ts";

describe("markdown renderer", () => {
  it("renders plain text references as clickable chips with line breaks", () => {
    const container = document.createElement("div");
    render(h("div", null, renderPlainTextWithReferences("见 @src/a.ts:2-3\n继续")), container);

    const chip = container.querySelector<HTMLElement>(".file-reference-chip");
    expect(chip).not.toBeNull();
    expect(chip?.dataset.path).toBe("src/a.ts");
    expect(container.querySelector("br")).not.toBeNull();
  });

  it("copies code text when copy button handler runs", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const container = renderToContainer("```ts\nconst value = 42;\n```");
    const button = container.querySelector<HTMLButtonElement>(".code-copy-button");

    button?.click();

    expect(writeText).toHaveBeenCalledWith("const value = 42;");
  });
});

function renderToContainer(text: string): HTMLElement {
  const container = document.createElement("div");
  render(h("div", null, renderAssistantMarkdown(text)), container);
  return container;
}
