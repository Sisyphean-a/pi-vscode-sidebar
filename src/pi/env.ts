export const BRIDGE_ENV_URL = "PI_VSCODE_BRIDGE_URL";
export const BRIDGE_ENV_TOKEN = "PI_VSCODE_BRIDGE_TOKEN";
export const BRIDGE_ENV_TERMINAL_ID = "PI_VSCODE_TERMINAL_ID";

export interface BridgeEnvironmentConfig {
  url: string;
  token: string;
  terminalId?: string;
}

export function createBridgeEnvironment(
  config: BridgeEnvironmentConfig | undefined,
): Record<string, string> | undefined {
  if (!config) return undefined;
  const environment: Record<string, string> = {
    [BRIDGE_ENV_URL]: config.url,
    [BRIDGE_ENV_TOKEN]: config.token,
  };
  if (config.terminalId) {
    environment[BRIDGE_ENV_TERMINAL_ID] = config.terminalId;
  }
  return environment;
}
