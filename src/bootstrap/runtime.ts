import * as vscode from "vscode";
import { createBridge } from "../bridge/extension-bridge.ts";
import { createLogger, normalizeLogLevel, type Logger } from "../host/logger.ts";
import { attachRpcTraceLogging } from "../host/rpc-trace-logger.ts";
import { createPiRpcProcessManager } from "../host/process-manager.ts";
import { createRpcClient } from "../host/rpc-client.ts";
import {
  createPiRpcArgs,
  createPiRuntimeEnvironment,
  findPiBinary,
  resolvePiRuntime,
} from "../pi/runtime.ts";
import { createSessionTracker } from "../session/tracker.ts";

export interface ExtensionRestoreState {
  hasRestored: boolean;
  pendingSession: string | undefined;
}

interface EnsureStartedOptions {
  bridge: Awaited<ReturnType<typeof createOptionalBridge>>;
  context: vscode.ExtensionContext;
  processManager: ReturnType<typeof createPiRpcProcessManager>;
  restoreState: ExtensionRestoreState;
  rpcClient: ReturnType<typeof createRpcClient>;
}

export function setupTraceLogging(
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
  const unsubscribeTrace = attachRpcTraceLogging(processManager, logger);
  context.subscriptions.push({ dispose: unsubscribeTrace });
  return logger;
}

export function createRestoreState(
  tracker: ReturnType<typeof createSessionTracker>,
): ExtensionRestoreState {
  return {
    pendingSession: Object.values(tracker.read()).at(-1),
    hasRestored: false,
  };
}

export async function createOptionalBridge(
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

export function readRpcTimeoutMs(): number {
  return vscode.workspace.getConfiguration("piSidebar").get<number>("rpcTimeoutMs") ?? 30000;
}

export function createEnsureStarted(options: EnsureStartedOptions) {
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
