export interface EditorReferencePosition {
  line: number;
  character: number;
}

export interface BuildPromptReferencePayloadOptions {
  path: string;
  start: EditorReferencePosition;
  end: EditorReferencePosition;
  selectedText: string;
  documentText: string;
  languageId: string;
}

export interface PromptReferencePayload {
  path: string;
  startLine: number;
  endLine?: number;
  content: string;
  language: string;
  reference: string;
}

export function formatPromptReferenceToken(
  path: string,
  startLine: number,
  endLine?: number,
): string {
  return endLine === undefined || endLine === startLine
    ? `@${path}:${startLine}`
    : `@${path}:${startLine}-${endLine}`;
}

export function buildPromptReferencePayload(
  options: BuildPromptReferencePayloadOptions,
): PromptReferencePayload {
  const startLine = options.start.line + 1;
  const normalizedContent = options.selectedText;
  const endLine = resolveInclusiveEndLine(options.start.line, options.end.line, normalizedContent);

  return {
    path: normalizeReferencePath(options.path),
    startLine,
    endLine: endLine > startLine ? endLine : undefined,
    content: normalizedContent,
    language: options.languageId,
    reference: formatPromptReferenceToken(
      normalizeReferencePath(options.path),
      startLine,
      endLine > startLine ? endLine : undefined,
    ),
  };
}

function resolveInclusiveEndLine(startLine: number, endLine: number, selectedText: string): number {
  if (!selectedText) {
    return startLine + 1;
  }

  if (endLine <= startLine) {
    return startLine + 1;
  }

  return selectedText.endsWith("\n") ? endLine : endLine + 1;
}

function normalizeReferencePath(path: string): string {
  return path.replaceAll("\\", "/");
}
