import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/extension.ts",
    external: ["vscode"],
    platform: "node",
    output: {
      file: "dist/extension.cjs",
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
]);
