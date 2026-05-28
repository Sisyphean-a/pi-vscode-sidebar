import * as vscode from "vscode";
import type { SidebarController } from "../host/controller.ts";
import type { SidebarViewProviderHandle } from "../view/extension/provider/provider.ts";

interface RegisterSidebarCommandsOptions {
  bridge: { dispose(): Promise<void> } | undefined;
  controller: SidebarController;
  provider: SidebarViewProviderHandle;
}

export function registerSidebarCommands(
  context: vscode.ExtensionContext,
  options: RegisterSidebarCommandsOptions,
): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("piSidebar.main", options.provider),
    vscode.commands.registerCommand("piSidebar.focus", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.piSidebar");
    }),
    vscode.commands.registerCommand("piSidebar.addSelectionToPrompt", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.piSidebar");
      await options.provider.insertActiveEditorReference();
    }),
    {
      dispose: () => {
        void options.controller.dispose();
        void options.bridge?.dispose();
      },
    },
  );
}
