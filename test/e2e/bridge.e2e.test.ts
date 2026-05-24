import assert from "node:assert/strict";
import * as vscode from "vscode";

const EXTENSION_ID = "local.pi-vscode-sidebar";

export async function runBridgeE2ETest(): Promise<void> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert(extension, `Missing extension: ${EXTENSION_ID}`);
  if (!extension.isActive) {
    await extension.activate();
  }

  const config = vscode.workspace.getConfiguration("piSidebar");
  const bridgeEnabled = config.get<boolean>("bridgeEnabled");
  assert.equal(
    bridgeEnabled,
    true,
    "Expected bridgeEnabled default setting to be true in real VSCode runtime.",
  );

  const bridgeTimeout = config.get<number>("bridgeRequestTimeoutMs");
  assert.equal(
    typeof bridgeTimeout,
    "number",
    "Expected bridgeRequestTimeoutMs to be readable in extension host runtime.",
  );
}
