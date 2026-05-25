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
const result = runNpmCommand([
  "exec",
  "--yes",
  "--package=@vscode/vsce",
  "--",
  "vsce",
  "package",
  "--no-yarn",
  "--out",
  outputPath,
]);

if (result.status !== 0) {
  console.error(`[package:vsix] Packaging failed for ${outputPath}.`);
  process.exit(result.status ?? 1);
}

function runNpmCommand(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawnSync(process.execPath, [npmExecPath, ...args], {
      stdio: "inherit",
      cwd: rootDir,
    });
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(npmCommand, args, {
    stdio: "inherit",
    cwd: rootDir,
    shell: process.platform === "win32",
  });
}
