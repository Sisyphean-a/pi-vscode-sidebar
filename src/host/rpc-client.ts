import type {
  RpcCommand,
  RpcExtensionUIResponse,
  RpcResponse,
  RpcSessionState,
} from "../shared/rpc-types.ts";
import type { PiRpcProcessManager } from "./process/manager.ts";

export interface RpcClient {
  send(command: RpcCommand, timeoutMs?: number): Promise<RpcResponse>;
  sendExtensionUiResponse(
    response: RpcExtensionUIResponse,
    timeoutMs?: number,
  ): Promise<RpcResponse>;
  getState(timeoutMs?: number): Promise<RpcSessionState | undefined>;
}

export function createRpcClient(manager: PiRpcProcessManager, defaultTimeoutMs: number): RpcClient {
  return {
    send(command, timeoutMs = defaultTimeoutMs) {
      return manager.send(command, timeoutMs);
    },
    sendExtensionUiResponse(response, timeoutMs = defaultTimeoutMs) {
      return manager.send(response as unknown as RpcCommand, timeoutMs);
    },
    async getState(timeoutMs = defaultTimeoutMs) {
      const response = await manager.send({ type: "get_state" }, timeoutMs);
      if (!response.success) return undefined;
      return response.data as RpcSessionState | undefined;
    },
  };
}
