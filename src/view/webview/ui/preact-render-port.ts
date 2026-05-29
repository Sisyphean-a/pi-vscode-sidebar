import { render, type ComponentChildren } from "preact";

export interface PreactRenderPort {
  render(node: ComponentChildren): void;
}

export function createPreactRenderPort(container: HTMLElement): PreactRenderPort {
  return {
    render(node) {
      render(node, container);
    },
  };
}
