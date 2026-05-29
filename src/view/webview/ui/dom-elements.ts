export function expectDocumentElementById<TElement extends HTMLElement>(id: string): TElement {
  const element = findDocumentElementById<TElement>(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

function findDocumentElementById<TElement extends HTMLElement>(id: string): TElement | null {
  const body = document.body;
  if (!body) return null;
  if (body.id === id) {
    return body as unknown as TElement;
  }
  const elements = body.getElementsByTagName("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements.item(index);
    if (!(element instanceof HTMLElement)) continue;
    if (element.id !== id) continue;
    return element as TElement;
  }
  return null;
}
