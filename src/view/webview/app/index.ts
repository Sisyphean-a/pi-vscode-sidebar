import { initializeSidebarApp } from "./runtime.ts";
import { expectDocumentElementById } from "../ui/dom-elements.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const root = expectDocumentElementById<HTMLElement>("app");

initializeSidebarApp({ root, vscode });
