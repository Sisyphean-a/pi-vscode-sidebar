import { createBridgeTools } from "./pi-vscode-bridge-tools.js";

export default function registerPiVsCodeBridge(pi) {
  const bridgeUrl = process.env.PI_VSCODE_BRIDGE_URL;
  const bridgeToken = process.env.PI_VSCODE_BRIDGE_TOKEN;
  if (!bridgeUrl || !bridgeToken) return;

  const callBridge = async (method, params = {}) => {
    const response = await fetch(`${bridgeUrl}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": bridgeToken,
      },
      body: JSON.stringify({ method, params }),
    });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = payload?.error || `Bridge request failed with status ${response.status}`;
      throw new Error(message);
    }
    return payload?.result;
  };

  const jsonResult = async (method, params) => ({
    content: [{ type: "text", text: JSON.stringify(await callBridge(method, params), null, 2) }],
    details: {},
  });

  const noParamsTool = ({ rpcMethod, ...tool }) => ({
    ...tool,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => jsonResult(rpcMethod, {}),
  });

  const withParamsTool = ({ rpcMethod, parameters, ...tool }) => ({
    ...tool,
    parameters,
    execute: async (_toolCallId, params) => jsonResult(rpcMethod, params),
  });

  const tools = createBridgeTools({ noParamsTool, withParamsTool });
  for (const tool of tools) pi.registerTool(tool);
}
