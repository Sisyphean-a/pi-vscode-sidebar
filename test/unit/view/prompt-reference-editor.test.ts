// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createPromptReferenceEditor } from "../../../src/view/webview/ui/prompt-reference-editor.ts";

describe("prompt reference editor", () => {
  it("inserts a prompt reference at current selection", () => {
    const promptInput = document.createElement("textarea");
    promptInput.value = "hello world";
    promptInput.selectionStart = 5;
    promptInput.selectionEnd = 5;
    const syncHeight = vi.fn();
    const editor = createPromptReferenceEditor({
      promptInput: createPromptReferenceInput(promptInput, syncHeight),
    });

    editor.insert({ reference: "#file:src/app.ts:12" });

    expect(promptInput.value).toBe("hello #file:src/app.ts:12 world");
    expect(promptInput.selectionStart).toBe(promptInput.value.length - " world".length);
    expect(promptInput.selectionEnd).toBe(promptInput.selectionStart);
    expect(syncHeight).toHaveBeenCalledOnce();
  });

  it("ignores invalid payloads", () => {
    const promptInput = document.createElement("textarea");
    promptInput.value = "hello";
    const syncHeight = vi.fn();
    const editor = createPromptReferenceEditor({
      promptInput: createPromptReferenceInput(promptInput, syncHeight),
    });

    editor.insert({ ref: "missing-reference-field" });
    editor.insert({ reference: 1 });

    expect(promptInput.value).toBe("hello");
    expect(syncHeight).not.toHaveBeenCalled();
  });
});

function createPromptReferenceInput(promptInput: HTMLTextAreaElement, syncHeight: () => void) {
  return {
    focus() {
      promptInput.focus();
    },
    getSelectionEnd() {
      return promptInput.selectionEnd;
    },
    getSelectionStart() {
      return promptInput.selectionStart;
    },
    getValue() {
      return promptInput.value;
    },
    setSelection(start: number, end: number) {
      promptInput.selectionStart = start;
      promptInput.selectionEnd = end;
    },
    setValue(value: string) {
      promptInput.value = value;
    },
    syncHeight,
  };
}
