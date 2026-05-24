import * as vscode from "vscode";
import { createBridge } from "./bridge/extension-bridge.ts";
import { createSidebarController } from "./host/controller.ts";
import { createPiRpcProcessManager } from "./host/process-manager.ts";
import { createRpcClient } from "./host/rpc-client.ts";
import { createRpcSessionStateStore } from "./host/state-store.ts";
import { createPiRpcArgs, createPiRuntimeEnvironment, findPiBinary } from "./pi/runtime.ts";
import { createSessionTracker } from "./session/tracker.ts";
import { createSidebarViewProvider } from "./view/provider.ts";

export async function activate(context: vscode.ExtensionContext) {
  const processManager = createPiRpcProcessManager();
  setupTraceLogging(context, processManager);
  const tracker = createSessionTracker(context);
  await tracker.pruneMissingSessions();
  const restoreState = createRestoreState(tracker);

  const bridge = await createOptionalBridge(context, tracker);
  const defaultTimeoutMs = readRpcTimeoutMs();
  const rpcClient = createRpcClient(processManager, defaultTimeoutMs);

  const ensureStarted = createEnsureStarted({
    context,
    processManager,
    rpcClient,
    bridge,
    restoreState,
  });

  const controller = createSidebarController({
    processManager,
    rpcClient,
    stateStore: createRpcSessionStateStore(),
    ensureStarted,
    onRpcState: async (state) => {
      if (!state.sessionId || !state.sessionFile) return;
      restoreState.pendingSession = state.sessionFile;
      restoreState.hasRestored = true;
      await tracker.update(state.sessionId, state.sessionFile);
    },
  });

  const provider = createSidebarViewProvider({
    extensionUri: context.extensionUri,
    controller,
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("piSidebar.main", provider),
    vscode.commands.registerCommand("piSidebar.focus", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.piSidebar");
    }),
    {
      dispose: () => {
        void controller.dispose();
        void bridge?.dispose();
      },
    },
  );
}

export async function deactivate() {}

function setupTraceLogging(
  context: vscode.ExtensionContext,
  processManager: ReturnType<typeof createPiRpcProcessManager>,
): void {
  const output = vscode.window.createOutputChannel("Pi Sidebar");
  context.subscriptions.push(output);
  const unsubscribeTrace = processManager.onEvent((event) => {
    if (event.type === "rpc_command_sent") {
      output.appendLine(`[rpc] send id=${event.id} command=${event.command}`);
    } else if (event.type === "rpc_response") {
      output.appendLine(
        `[rpc] response id=${event.id ?? "n/a"} command=${event.command} success=${event.success}`,
      );
    } else if (event.type === "process_exit") {
      output.appendLine(
        `[rpc] process_exit code=${event.code ?? "null"} signal=${event.signal ?? "null"}`,
      );
    }
  });
  context.subscriptions.push({ dispose: unsubscribeTrace });
}

function createRestoreState(tracker: ReturnType<typeof createSessionTracker>) {
  return {
    pendingSession: Object.values(tracker.read()).at(-1),
    hasRestored: false,
  };
}

async function createOptionalBridge(
  context: vscode.ExtensionContext,
  tracker: ReturnType<typeof createSessionTracker>,
) {
  const bridgeEnabled =
    vscode.workspace.getConfiguration("piSidebar").get<boolean>("bridgeEnabled") ?? true;
  if (!bridgeEnabled) return undefined;
  return createBridge(context, async (sessionId, sessionFile) => {
    await tracker.update(sessionId, sessionFile);
  });
}

function readRpcTimeoutMs(): number {
  return vscode.workspace.getConfiguration("piSidebar").get<number>("rpcTimeoutMs") ?? 30000;
}

function createEnsureStarted(options: {
  context: vscode.ExtensionContext;
  processManager: ReturnType<typeof createPiRpcProcessManager>;
  rpcClient: ReturnType<typeof createRpcClient>;
  bridge: Awaited<ReturnType<typeof createOptionalBridge>>;
  restoreState: { pendingSession: string | undefined; hasRestored: boolean };
}) {
  return async () => {
    if (options.processManager.isRunning()) return;

    const piPath = findPiBinary();
    await options.processManager.start({
      piPath,
      args: createPiRpcArgs({ extensionUri: options.context.extensionUri }),
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      env: createPiRuntimeEnvironment(
        options.bridge ? { url: options.bridge.url, token: options.bridge.token } : undefined,
      ),
    });
    if (!options.restoreState.pendingSession || options.restoreState.hasRestored) return;

    options.restoreState.hasRestored = true;
    await options.rpcClient.send({
      type: "switch_session",
      sessionPath: options.restoreState.pendingSession,
    });
  };
}
