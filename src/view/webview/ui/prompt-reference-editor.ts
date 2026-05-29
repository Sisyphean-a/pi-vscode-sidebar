import { z } from "zod";

interface CreatePromptReferenceEditorOptions {
  promptInput: PromptReferenceInput;
}

export interface PromptReferenceInput {
  focus(): void;
  getSelectionEnd(): number | null;
  getSelectionStart(): number | null;
  getValue(): string;
  setSelection(start: number, end: number): void;
  setValue(value: string): void;
  syncHeight(): void;
}

export interface PromptReferenceEditor {
  insert(payload: unknown): void;
}

const PromptReferencePayloadSchema = z
  .object({
    reference: z.string(),
  })
  .catchall(z.unknown());

export function createPromptReferenceEditor(
  options: CreatePromptReferenceEditorOptions,
): PromptReferenceEditor {
  return {
    insert(payload) {
      const parsed = PromptReferencePayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      insertTextAtSelection(
        options,
        buildPromptReferenceInsertion(options.promptInput, parsed.data.reference),
      );
      options.promptInput.focus();
    },
  };
}

function insertTextAtSelection(options: CreatePromptReferenceEditorOptions, text: string): void {
  const value = options.promptInput.getValue();
  const start = options.promptInput.getSelectionStart() ?? value.length;
  const end = options.promptInput.getSelectionEnd() ?? value.length;
  const nextValue = [
    value.slice(0, start),
    text,
    value.slice(end),
  ].join("");
  options.promptInput.setValue(nextValue);
  const nextCursor = start + text.length;
  options.promptInput.setSelection(nextCursor, nextCursor);
  options.promptInput.syncHeight();
}

function buildPromptReferenceInsertion(promptInput: PromptReferenceInput, reference: string): string {
  const value = promptInput.getValue();
  const start = promptInput.getSelectionStart() ?? value.length;
  const end = promptInput.getSelectionEnd() ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const prefix = shouldInsertLeadingSpace(before) ? " " : "";
  const suffix = shouldInsertTrailingSpace(after) ? " " : "";
  return `${prefix}${reference}${suffix}`;
}

function shouldInsertLeadingSpace(text: string): boolean {
  if (!text) return false;
  return !/\s$/.test(text);
}

function shouldInsertTrailingSpace(text: string): boolean {
  if (!text) return true;
  return !/^\s/.test(text);
}
