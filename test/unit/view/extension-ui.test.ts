// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createExtensionUiRenderer } from "../../../src/view/webview/extension-ui.ts";

describe("extension ui renderer", () => {
  it("renders notify card and emits notice event", () => {
    const harness = createHarness();

    harness.render({
      id: "req-notify",
      method: "notify",
      level: "warning",
      message: "Bridge disconnected",
    });

    expect(harness.panel.classList.contains("hidden")).toBe(false);
    expect(harness.panel.textContent).toContain("Bridge disconnected");
    expect(harness.notices).toEqual(["[warning] Bridge disconnected"]);
    expect(harness.responses).toEqual([]);
  });

  it("applies setStatus and setTitle without posting rpc response", () => {
    const harness = createHarness();

    harness.render({
      id: "req-status",
      method: "setStatus",
      statusKey: "busy",
      statusText: "Working",
    });
    harness.render({ id: "req-title", method: "setTitle", title: "Session A" });

    expect(harness.statusUpdates).toEqual([{ statusKey: "busy", statusText: "Working" }]);
    expect(harness.titles).toEqual(["Session A"]);
    expect(harness.responses).toEqual([]);
  });

  it("opens set_editor_text editor panel and applies edited text", () => {
    const harness = createHarness();

    harness.render({
      id: "req-editor",
      method: "set_editor_text",
      text: "const a = 1;",
    });

    const editor = harness.expectElement<HTMLTextAreaElement>("ext-editor-text");
    editor.value = "const a = 2;";
    harness.expectElement<HTMLButtonElement>("ext-apply-editor-text").click();

    expect(harness.editorTexts).toEqual(["const a = 2;"]);
    expect(harness.panel.classList.contains("hidden")).toBe(true);
    expect(harness.responses).toEqual([]);
  });

  it("keeps interactive input flow posting response payload", () => {
    const harness = createHarness();

    harness.render({
      id: "req-input",
      method: "input",
      title: "Need approval",
      prefill: "ok",
    });

    const input = harness.expectElement<HTMLTextAreaElement>("ext-input");
    input.value = "approved";
    harness.expectElement<HTMLButtonElement>("ext-submit").click();

    expect(harness.responses).toEqual([{ requestId: "req-input", payload: "approved" }]);
  });
});

function createHarness() {
  document.body.innerHTML = `<section id="panel" class="hidden"></section>`;
  const panel = expectElement<HTMLElement>("panel");
  const responses: Array<{ requestId: string; payload: unknown }> = [];
  const statusUpdates: Array<{ statusKey: string; statusText?: string }> = [];
  const titles: string[] = [];
  const editorTexts: string[] = [];
  const notices: string[] = [];

  const render = createExtensionUiRenderer({
    panel,
    escapeHtml(text) {
      return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    },
    expectElement,
    postResponse(requestId, payload) {
      responses.push({ requestId, payload });
    },
    updateStatus(statusKey, statusText) {
      statusUpdates.push({ statusKey, statusText });
    },
    updateTitle(nextTitle) {
      titles.push(nextTitle);
    },
    setEditorText(text) {
      editorTexts.push(text);
    },
    queueNotice(message) {
      notices.push(message);
    },
  });

  return {
    panel,
    responses,
    statusUpdates,
    titles,
    editorTexts,
    notices,
    render,
    expectElement,
  };
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
