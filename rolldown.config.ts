import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/extension.ts",
    external: ["vscode"],
    platform: "node",
    output: {
      file: "dist/extension.js",
      format: "cjs",
      sourcemap: true,
    },
  },
  {
    input: "src/view/webview/app.ts",
    platform: "browser",
    output: {
      file: "dist/webview/app.js",
      format: "iife",
      name: "PiSidebarWebview",
      sourcemap: true,
    },
  },
  {
    input: "src/view/webview/panel-log-app.ts",
    platform: "browser",
    output: {
      file: "dist/webview/panel-log-app.js",
      format: "iife",
      name: "PiSidebarPanelLogWebview",
      sourcemap: true,
    },
  },
]);
