import { initializeSidebarApp } from "./runtime.ts";

declare function acquireVsCodeApi<T>(): {
  postMessage(message: T): void;
};

const vscode = acquireVsCodeApi<object>();
const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

initializeSidebarApp({ root, vscode });
