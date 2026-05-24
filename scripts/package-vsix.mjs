import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = typeof packageJson.version === "string" ? packageJson.version : "";

if (!version) {
  console.error("[package:vsix] Missing version in package.json.");
  process.exit(1);
}

const outputPath = `dist/pi-vscode-sidebar-${version}.vsix`;
const result = spawnSync(
  "pnpm",
  ["dlx", "@vscode/vsce", "package", "--no-yarn", "--out", outputPath],
  {
    stdio: "inherit",
    shell: true,
    cwd: rootDir,
  },
);

if (result.status !== 0) {
  console.error(`[package:vsix] Packaging failed for ${outputPath}.`);
  process.exit(result.status ?? 1);
}
