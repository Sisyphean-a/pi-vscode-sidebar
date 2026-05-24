import { join } from "node:path";
import * as vscode from "vscode";
import { createBridgeEnvironment, type BridgeEnvironmentConfig } from "./env.ts";
import { resolvePiBinary } from "./resolve.ts";
export { resolvePiRuntime, type ResolvedPiRuntime } from "./resolve.ts";

const BRIDGE_EXTENSION_PATH = "bridge/pi-vscode-bridge.js";

export interface CreateRpcArgsOptions {
  extensionUri: vscode.Uri;
  contextLines?: string[];
}

export function findPiBinary(configKey = "piSidebar.path"): string {
  const customPath = vscode.workspace.getConfiguration().get<string>(configKey) || undefined;
  const workspaceDirs = (vscode.workspace.workspaceFolders ?? []).map(
    (folder) => folder.uri.fsPath,
  );
  return resolvePiBinary({ customPath, workspaceDirs });
}

export function createPiRpcArgs(options: CreateRpcArgsOptions): string[] {
  const args = ["--mode", "rpc", "--no-session", "--extension", bridgePath(options.extensionUri)];
  if (options.contextLines && options.contextLines.length > 0) {
    args.push("--append-system-prompt", options.contextLines.join("\n\n"));
  }
  return args;
}

export function createPiRuntimeEnvironment(
  bridgeConfig: BridgeEnvironmentConfig | undefined,
): NodeJS.ProcessEnv {
  const bridgeEnv = createBridgeEnvironment(bridgeConfig) ?? {};
  return { ...process.env, ...bridgeEnv };
}

function bridgePath(extensionUri: vscode.Uri): string {
  return join(extensionUri.fsPath, BRIDGE_EXTENSION_PATH);
}
