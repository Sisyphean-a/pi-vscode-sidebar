import * as vscode from "vscode";
import { registerSidebarCommands } from "./commands.ts";
import { registerPanelLogView } from "./panel-log-view.ts";
import {
  createEnsureStarted,
  createOptionalBridge,
  createRestoreState,
  readRpcTimeoutMs,
  setupTraceLogging,
} from "./runtime.ts";
import { createLogBroadcaster } from "../host/log-broadcaster.ts";
import { createSidebarController } from "../host/controller.ts";
import { createPiRpcProcessManager } from "../host/process/manager.ts";
import { createRpcClient } from "../host/rpc-client.ts";
import { createRpcSessionStateStore } from "../host/state-store.ts";
import { createRecentSessionsProvider } from "../session/recent-sessions.ts";
import { createPanelLogViewProvider } from "../view/extension/panel-log/provider.ts";
import { createSessionTracker } from "../session/tracker.ts";
import { createSidebarViewProvider } from "../view/extension/provider/provider.ts";

export async function activate(context: vscode.ExtensionContext) {
  const processManager = createPiRpcProcessManager();
  const logBroadcaster = createLogBroadcaster();
  const logger = setupTraceLogging(context, processManager, logBroadcaster);
  const tracker = createSessionTracker(context);
  const recentSessions = createRecentSessionsProvider({
    workspaceDir: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });
  await tracker.pruneMissingSessions();

  const restoreState = createRestoreState(tracker);
  const bridge = await createOptionalBridge(context, tracker);
  const rpcClient = createRpcClient(processManager, readRpcTimeoutMs());
  const ensureStarted = createEnsureStarted({
    bridge,
    context,
    processManager,
    restoreState,
    rpcClient,
  });
  const controller = createSidebarController({
    processManager,
    rpcClient,
    stateStore: createRpcSessionStateStore(),
    ensureStarted,
    logger,
    listRecentSessions: () => recentSessions.list(),
    onRpcState: async (state) => {
      if (!state.sessionId || !state.sessionFile) return;
      restoreState.pendingSession = state.sessionFile;
      restoreState.hasRestored = true;
      await tracker.update(state.sessionId, state.sessionFile);
    },
  });
  const provider = createSidebarViewProvider({
    extensionUri: context.extensionUri,
    storageUri: context.globalStorageUri,
    controller,
  });
  const panelLogProvider = createPanelLogViewProvider({
    extensionUri: context.extensionUri,
    broadcaster: logBroadcaster,
  });

  registerSidebarCommands(context, {
    bridge,
    controller,
    provider,
  });
  registerPanelLogView(context, panelLogProvider);
}

export async function deactivate() {}
