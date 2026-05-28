import { describe, expect, it } from "vitest";
import { resolveExtensionUiRequest } from "../../../src/view/webview/extension-ui-state.ts";

describe("extension ui state", () => {
  it("returns undefined for invalid envelope and missing required ids", () => {
    expect(resolveExtensionUiRequest(null)).toBeUndefined();
    expect(
      resolveExtensionUiRequest({
        method: "select",
      }),
    ).toBeUndefined();
    expect(
      resolveExtensionUiRequest({
        id: "req-confirm",
        method: "confirm",
      }),
    ).toEqual({
      type: "confirm",
      requestId: "req-confirm",
      titleText: "请确认",
      message: "",
    });
  });

  it("normalizes notify payload into the final inline notice text", () => {
    expect(
      resolveExtensionUiRequest({
        method: "notify",
        notifyType: "warning",
        message: "Bridge disconnected",
      }),
    ).toEqual({
      type: "notify",
      noticeMessage: "[警告] Bridge disconnected",
    });
  });

  it("applies default titles and parses select/input payloads", () => {
    expect(
      resolveExtensionUiRequest({
        id: "req-select",
        method: "select",
        options: ["A", "B", 1],
      }),
    ).toEqual({
      type: "select",
      requestId: "req-select",
      titleText: "需要选择",
      options: ["A", "B"],
    });

    expect(
      resolveExtensionUiRequest({
        id: "req-input",
        method: "input",
        prefill: "ok",
      }),
    ).toEqual({
      type: "input",
      requestId: "req-input",
      titleText: "请输入",
      placeholder: "",
      prefill: "ok",
    });
  });

  it("parses status, title, and set_editor_text requests without changing messages", () => {
    expect(
      resolveExtensionUiRequest({
        method: "setStatus",
        statusKey: "busy",
        statusText: "Working",
      }),
    ).toEqual({
      type: "status",
      statusKey: "busy",
      statusText: "Working",
    });

    expect(
      resolveExtensionUiRequest({
        method: "setTitle",
        title: "Session A",
      }),
    ).toEqual({
      type: "title",
      title: "Session A",
    });

    expect(
      resolveExtensionUiRequest({
        method: "set_editor_text",
        text: "const a = 1;",
      }),
    ).toEqual({
      type: "set_editor_text",
      text: "const a = 1;",
    });
  });

  it("returns hide for unknown methods", () => {
    expect(
      resolveExtensionUiRequest({
        method: "something_else",
      }),
    ).toEqual({ type: "hide" });
  });
});
