import * as vscode from "vscode";
import { createBridge } from "./bridge/extension-bridge.ts";
import { createSidebarController } from "./host/controller.ts";
import { createLogger, normalizeLogLevel, type Logger } from "./host/logger.ts";
import { createPiRpcProcessManager } from "./host/process-manager.ts";
import { createRpcClient } from "./host/rpc-client.ts";
import { createRpcSessionStateStore } from "./host/state-store.ts";
import {
  createPiRpcArgs,
  createPiRuntimeEnvironment,
  findPiBinary,
  resolvePiRuntime,
} from "./pi/runtime.ts";
import { createSessionTracker } from "./session/tracker.ts";
import { createSidebarViewProvider } from "./view/provider.ts";

export async function activate(context: vscode.ExtensionContext) {
  const processManager = createPiRpcProcessManager();
  const logger = setupTraceLogging(context, processManager);
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
    logger,
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
    vscode.commands.registerCommand("piSidebar.addSelectionToPrompt", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.piSidebar");
      await provider.insertActiveEditorReference();
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
): Logger {
  const output = vscode.window.createOutputChannel("Pi Sidebar");
  context.subscriptions.push(output);
  const logLevel = normalizeLogLevel(
    vscode.workspace.getConfiguration("piSidebar").get<string>("logLevel"),
  );
  const logger = createLogger({
    level: logLevel,
    write(line) {
      output.appendLine(line);
    },
  });
  logger.info({ scope: "extension", message: `logger initialized at level=${logLevel}` });
  const unsubscribeTrace = processManager.onEvent((event) => {
    if (event.type === "rpc_command_sent") {
      logger.debug({
        scope: "rpc",
        correlationId: event.id,
        message: "rpc command sent",
        details: { command: event.command },
      });
    } else if (event.type === "rpc_response") {
      logger.debug({
        scope: "rpc",
        correlationId: event.id,
        message: "rpc response received",
        details: { command: event.command, success: event.success },
      });
    } else if (event.type === "process_exit") {
      logger.error({
        scope: "rpc",
        message: "rpc process exited",
        details: { code: event.code ?? null, signal: event.signal ?? null },
      });
    } else if (event.type === "stderr") {
      logger.warn({
        scope: "rpc",
        message: "rpc stderr",
        details: { message: event.message },
      });
    }
  });
  context.subscriptions.push({ dispose: unsubscribeTrace });
  return logger;
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

    const runtime = resolvePiRuntime({ customPath: findPiBinary() });
    await options.processManager.start({
      executable: runtime.executable,
      args: [...runtime.args, ...createPiRpcArgs({ extensionUri: options.context.extensionUri })],
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
