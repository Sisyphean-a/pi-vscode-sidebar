const MIN_PROMPT_HEIGHT_PX = 72;
const MAX_PROMPT_HEIGHT_PX = 220;

export function syncComposerHeight(textarea: HTMLTextAreaElement): void {
  const minHeight = `${MIN_PROMPT_HEIGHT_PX}px`;
  if (!textarea.value.trim()) {
    textarea.style.height = minHeight;
    textarea.style.overflowY = "hidden";
    return;
  }

  textarea.style.height = "auto";
  const boundedHeight = Math.max(
    MIN_PROMPT_HEIGHT_PX,
    Math.min(textarea.scrollHeight, MAX_PROMPT_HEIGHT_PX),
  );
  textarea.style.height = `${boundedHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > MAX_PROMPT_HEIGHT_PX ? "auto" : "hidden";
}

export function resetComposerHeight(textarea: HTMLTextAreaElement): void {
  textarea.style.height = `${MIN_PROMPT_HEIGHT_PX}px`;
  textarea.style.overflowY = "hidden";
}
