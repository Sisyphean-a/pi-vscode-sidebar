import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { runTests } from "@vscode/test-electron";

const E2E_FILES = ["bootstrap.ts", "sidebar.e2e.test.ts", "bridge.e2e.test.ts"] as const;

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(path.join(import.meta.dirname, "..", ".."));
  const e2eRoot = path.resolve(import.meta.dirname);
  const runtimeRoot = mkdtempSync(path.join(tmpdir(), "pi-sidebar-e2e-runtime-"));
  const compiledRoot = prepareCompiledE2E(e2eRoot);
  const userDataDir = path.join(runtimeRoot, "user-data");
  const extensionsDir = path.join(runtimeRoot, "extensions");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(extensionsDir, { recursive: true });

  await runTests({
    extensionDevelopmentPath: workspaceRoot,
    extensionTestsPath: path.join(compiledRoot, "bootstrap.js"),
    launchArgs: [
      workspaceRoot,
      "--disable-extensions",
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extensionsDir}`,
    ],
  });
}

function prepareCompiledE2E(e2eRoot: string): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), "pi-sidebar-e2e-"));
  const outDir = path.join(tempDir, "compiled");
  mkdirSync(outDir, { recursive: true });

  for (const fileName of E2E_FILES) {
    const sourcePath = path.join(e2eRoot, fileName);
    const outputPath = path.join(outDir, fileName.replace(/\.ts$/, ".js"));
    const source = readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: sourcePath,
    });
    const outputText = transpiled.outputText.replace(/\.ts(["'])/g, ".js$1");
    writeFileSync(outputPath, outputText, "utf8");
  }

  return outDir;
}

main().catch((error) => {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(detail);
  process.exitCode = 1;
});
