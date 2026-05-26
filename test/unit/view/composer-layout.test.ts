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

  it("renders model controls as custom text triggers instead of native selects", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(SIDEBAR_TEMPLATE).not.toContain('<select id="model-select"');
    expect(SIDEBAR_TEMPLATE).not.toContain('<select id="thinking-level-select"');
    expect(SIDEBAR_TEMPLATE).toContain('id="model-picker-trigger"');
    expect(SIDEBAR_TEMPLATE).toContain('id="thinking-level-picker-trigger"');
    expect(styles).toMatch(/\.composer-picker-trigger\s*\{/);
  });

  it("allows picker panels to overflow above the composer meta row", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(/\.composer-meta\s*\{[\s\S]*overflow:\s*visible;/);
  });

  it("prevents horizontal scrolling and removes the inner focus outline from the prompt textarea", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(/\.composer textarea\s*\{[\s\S]*overflow-x:\s*hidden;/);
    expect(styles).toMatch(/\.composer textarea\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(styles).toMatch(/\.composer textarea:focus-visible\s*\{[\s\S]*outline:\s*none;/);
  });

  it("keeps the conversation from horizontally scrolling while code blocks scroll internally", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(/\.message-feed\s*\{[\s\S]*overflow-x:\s*hidden;/);
    expect(styles).toMatch(/\.chat-message\s*\{[\s\S]*min-width:\s*0;/);
    expect(styles).toMatch(/\.chat-content\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(styles).toMatch(/\.chat-content > \*\s*\{[\s\S]*max-width:\s*100%;/);
    expect(styles).toMatch(/\.code-block\s*\{[\s\S]*max-width:\s*100%;/);
    expect(styles).toMatch(/\.code-block pre\s*\{[\s\S]*overflow-x:\s*auto;/);
  });

  it("keeps block code visually flat so only the outer code block provides the background", () => {
    const styles = readFileSync(
      new URL("../../../src/view/webview/styles.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(/\.code-block pre code\s*\{[\s\S]*background:\s*transparent;/);
    expect(styles).toMatch(/\.code-block pre code\s*\{[\s\S]*border-radius:\s*0;/);
  });
});
