import {
  isAgentEventLike,
  isRpcExtensionUiRequest,
  isRpcResponse,
  type RpcOutputMessage,
  type RpcResponse,
} from "../../shared/rpc-types.ts";

export type InterpretedProcessPayload =
  | {
      type: "rpc_response";
      id?: string;
      command: string;
      success: boolean;
      payload: RpcResponse;
      resolveId?: string;
      emitPayloadDirectly: boolean;
    }
  | { type: "output"; payload: RpcOutputMessage }
  | { type: "stderr"; message: string };

export function interpretProcessPayload(payload: unknown): InterpretedProcessPayload {
  if (isRpcResponse(payload)) {
    return {
      type: "rpc_response",
      id: payload.id,
      command: payload.command,
      success: payload.success,
      payload,
      resolveId: payload.id,
      emitPayloadDirectly: !payload.id,
    };
  }
  if (isRpcExtensionUiRequest(payload) || isAgentEventLike(payload)) {
    return {
      type: "output",
      payload,
    };
  }
  return {
    type: "stderr",
    message: `Unknown RPC payload: ${JSON.stringify(payload)}`,
  };
}
