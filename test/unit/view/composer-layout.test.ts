import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIDEBAR_TEMPLATE } from "../../../src/view/webview/template.ts";

describe("composer layout source", () => {
  it("keeps the prompt input as a multiline textarea", () => {
    expect(SIDEBAR_TEMPLATE).toContain('textarea id="prompt-input" rows="1"');
    expect(SIDEBAR_TEMPLATE).not.toContain('wrap="off"');
  });

  it("keeps the toolbar in one row even on narrow widths", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(/\.composer-toolbar\s*\{[\s\S]*display:\s*grid;/);
    expect(styles).not.toMatch(
      /@media\s*\(max-width:\s*360px\)\s*\{[\s\S]*?\.composer-toolbar\s*\{[\s\S]*?flex-wrap:\s*wrap;/,
    );
  });

  it("renders model controls as plain clickable text without arrow shells", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(SIDEBAR_TEMPLATE).not.toContain("composer-select-shell");
    expect(styles).not.toMatch(/\.composer-select-shell::after/);
  });
});
