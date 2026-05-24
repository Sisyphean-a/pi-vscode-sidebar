import assert from "node:assert/strict";
import * as vscode from "vscode";

const EXTENSION_ID = "local.pi-vscode-sidebar";
const SIDEBAR_COMMAND = "piSidebar.focus";

export async function runSidebarE2ETest(): Promise<void> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert(extension, `Missing extension: ${EXTENSION_ID}`);

  if (!extension.isActive) {
    await extension.activate();
  }

  const commands = await vscode.commands.getCommands(true);
  assert(commands.includes(SIDEBAR_COMMAND), `Missing command registration: ${SIDEBAR_COMMAND}`);

  await vscode.commands.executeCommand(SIDEBAR_COMMAND);
  await wait(300);

  assert.equal(extension.isActive, true, "Extension must remain active after focus command.");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
