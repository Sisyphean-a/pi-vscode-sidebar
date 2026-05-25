import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const changelogPath = path.join(rootDir, "CHANGELOG.md");

validateVersion();
validateChangelog();
runRequiredChecks();

function validateVersion() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const version = typeof pkg.version === "string" ? pkg.version : "";
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`Invalid package version: "${version}"`);
  }
}

function validateChangelog() {
  if (!existsSync(changelogPath)) {
    fail("CHANGELOG.md is required for release.");
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const version = pkg.version;
  const changelog = readFileSync(changelogPath, "utf8");
  const versionHeader = `## [${version}]`;
  if (!changelog.includes(versionHeader)) {
    fail(`CHANGELOG.md must include entry "${versionHeader}".`);
  }
}

function runRequiredChecks() {
  runNpmCommand(["run", "verify"]);
  runNpmCommand(["run", "test:e2e"]);
  runNpmCommand(["run", "test:perf"]);
}

function runNpmCommand(args) {
  const npmExecPath = process.env.npm_execpath;
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, ...args], {
        stdio: "inherit",
        cwd: rootDir,
      })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
        stdio: "inherit",
        cwd: rootDir,
        shell: process.platform === "win32",
      });

  if (result.status !== 0) {
    fail(`Command failed: npm ${args.join(" ")}`);
  }
}

function fail(message) {
  console.error(`[release:check] ${message}`);
  process.exit(1);
}
