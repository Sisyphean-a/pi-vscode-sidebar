import { z } from "zod";

interface CreatePromptReferenceEditorOptions {
  promptInput: HTMLTextAreaElement;
  syncComposerHeight(input: HTMLTextAreaElement): void;
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
  const start = options.promptInput.selectionStart ?? options.promptInput.value.length;
  const end = options.promptInput.selectionEnd ?? options.promptInput.value.length;
  options.promptInput.value = [
    options.promptInput.value.slice(0, start),
    text,
    options.promptInput.value.slice(end),
  ].join("");
  const nextCursor = start + text.length;
  options.promptInput.selectionStart = nextCursor;
  options.promptInput.selectionEnd = nextCursor;
  options.syncComposerHeight(options.promptInput);
}

function buildPromptReferenceInsertion(
  promptInput: HTMLTextAreaElement,
  reference: string,
): string {
  const start = promptInput.selectionStart ?? promptInput.value.length;
  const end = promptInput.selectionEnd ?? promptInput.value.length;
  const before = promptInput.value.slice(0, start);
  const after = promptInput.value.slice(end);
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
