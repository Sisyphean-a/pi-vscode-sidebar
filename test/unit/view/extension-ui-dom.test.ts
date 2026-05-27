// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  renderExtensionUiConfirm,
  renderExtensionUiSetEditorText,
} from "../../../src/view/webview/extension-ui-dom.ts";

describe("extension ui dom", () => {
  it("posts confirm responses for yes, no, and cancel actions", () => {
    const harness = createHarness();

    renderExtensionUiConfirm(harness.options, {
      message: "继续?",
      requestId: "req-confirm",
      titleText: "请确认",
    });

    harness.expectElement<HTMLButtonElement>("ext-yes").click();
    expect(harness.responses).toEqual([{ payload: true, requestId: "req-confirm" }]);

    renderExtensionUiConfirm(harness.options, {
      message: "继续?",
      requestId: "req-confirm",
      titleText: "请确认",
    });
    harness.expectElement<HTMLButtonElement>("ext-no").click();
    expect(harness.responses.at(-1)).toEqual({ payload: false, requestId: "req-confirm" });

    renderExtensionUiConfirm(harness.options, {
      message: "继续?",
      requestId: "req-confirm",
      titleText: "请确认",
    });
    harness.expectElement<HTMLButtonElement>("ext-cancel").click();
    expect(harness.responses.at(-1)).toEqual({ payload: null, requestId: "req-confirm" });
    expect(harness.panel.classList.contains("hidden")).toBe(true);
  });

  it("applies edited editor text and queues the current notice copy", () => {
    const harness = createHarness();

    renderExtensionUiSetEditorText(harness.options, "const a = 1;");
    const editor = harness.expectElement<HTMLTextAreaElement>("ext-editor-text");
    editor.value = "const a = 2;";
    harness.expectElement<HTMLButtonElement>("ext-apply-editor-text").click();

    expect(harness.editorTexts).toEqual(["const a = 2;"]);
    expect(harness.notices).toEqual(["输入内容已更新。"]);
    expect(harness.responses).toEqual([]);
    expect(harness.panel.classList.contains("hidden")).toBe(true);
  });
});

function createHarness() {
  document.body.innerHTML = `<section id="panel" class="hidden"></section>`;
  const panel = expectElement<HTMLElement>("panel");
  const responses: Array<{ requestId: string; payload: unknown }> = [];
  const editorTexts: string[] = [];
  const notices: string[] = [];

  return {
    panel,
    responses,
    editorTexts,
    notices,
    expectElement,
    options: {
      panel,
      escapeHtml(text: string) {
        return text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      },
      expectElement,
      postResponse(requestId: string, payload: unknown) {
        responses.push({ payload, requestId });
      },
      queueNotice(message: string) {
        notices.push(message);
      },
      setEditorText(text: string) {
        editorTexts.push(text);
      },
    },
  };
}

function expectElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as TElement;
}
