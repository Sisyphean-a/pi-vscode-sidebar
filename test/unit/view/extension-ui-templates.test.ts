import { describe, expect, it } from "vitest";
import {
  renderConfirmTemplate,
  renderInputTemplate,
  renderSelectTemplate,
  renderSetEditorTextTemplate,
} from "../../../src/view/webview/extension-ui-templates.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

describe("extension ui templates", () => {
  it("renders select template with escaped title and options", () => {
    const html = renderSelectTemplate(
      {
        titleText: '选择 "<模型>"',
        options: ["alpha", 'b<&>"'],
      },
      escapeHtml,
    );

    expect(html).toContain("<h2>选择 &quot;&lt;模型&gt;&quot;</h2>");
    expect(html).toContain('<select id="ext-select">');
    expect(html).toContain('<option value="alpha">alpha</option>');
    expect(html).toContain("&lt;&amp;&gt;&quot;");
  });

  it("renders confirm, input, and set-editor templates with current ids and labels", () => {
    expect(renderConfirmTemplate({ titleText: "请确认", message: "继续?" }, escapeHtml)).toContain(
      '<button id="ext-yes" type="button">确认</button>',
    );
    expect(
      renderInputTemplate(
        {
          titleText: "Need input",
          placeholder: "type here",
          prefill: "preset",
        },
        escapeHtml,
      ),
    ).toContain('<textarea id="ext-input" rows="6" placeholder="type here">preset</textarea>');
    expect(renderSetEditorTextTemplate("const a = 1;", escapeHtml)).toContain(
      '<textarea id="ext-editor-text" rows="6">const a = 1;</textarea>',
    );
  });
});
