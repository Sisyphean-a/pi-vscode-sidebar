import type { RpcResponse } from "../shared/rpc-types.ts";
import type { ProcessEvent } from "./process-manager.ts";
import { interpretProcessPayload } from "./process-manager-payloads.ts";

interface DispatchProcessPayloadOptions {
  emit(event: ProcessEvent): void;
  resolvePending(id: string, payload: RpcResponse): void;
}

export function dispatchProcessPayload(
  payload: unknown,
  options: DispatchProcessPayloadOptions,
): void {
  const interpreted = interpretProcessPayload(payload);
  if (interpreted.type === "rpc_response") {
    options.emit({
      type: "rpc_response",
      id: interpreted.id,
      command: interpreted.command,
      success: interpreted.success,
      payload: interpreted.payload,
    });
    if (interpreted.resolveId) {
      options.resolvePending(interpreted.resolveId, interpreted.payload);
    } else if (interpreted.emitPayloadDirectly) {
      options.emit(interpreted.payload);
    }
    return;
  }
  if (interpreted.type === "output") {
    options.emit(interpreted.payload);
    return;
  }
  options.emit({
    type: "stderr",
    message: interpreted.message,
  });
}
