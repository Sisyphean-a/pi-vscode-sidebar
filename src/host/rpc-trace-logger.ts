import type { Logger } from "./logger.ts";
import type { PiRpcProcessManager, ProcessEvent } from "./process/manager.ts";
import type { Unsubscribe } from "./message-bus.ts";

export function attachRpcTraceLogging(
  processManager: PiRpcProcessManager,
  logger: Logger,
): Unsubscribe {
  return processManager.onEvent((event) => {
    if (event.type === "rpc_command_sent") {
      logger.info({
        scope: "rpc",
        correlationId: event.id,
        message: "rpc outbound",
        details: event.payload,
      });
      return;
    }

    if (event.type === "rpc_response") {
      logger.info({
        scope: "rpc",
        correlationId: event.id,
        message: "rpc inbound response",
        details: event.payload,
      });
      return;
    }

    if (event.type === "process_exit") {
      logger.error({
        scope: "rpc",
        message: "rpc process exited",
        details: { code: event.code ?? null, signal: event.signal ?? null },
      });
      return;
    }

    if (event.type === "stderr") {
      logger.warn({
        scope: "rpc",
        message: "rpc stderr",
        details: { message: event.message },
      });
      return;
    }

    logger.info({
      scope: "rpc",
      correlationId: readEventCorrelationId(event),
      message: `rpc inbound event: ${event.type}`,
      details: event,
    });
  });
}

function readEventCorrelationId(event: ProcessEvent): string | undefined {
  const record = event as Record<string, unknown>;
  const id = record.id;
  if (typeof id === "string") return id;
  const responseId = record.responseId;
  return typeof responseId === "string" ? responseId : undefined;
}
