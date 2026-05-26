import { describe, expect, it } from "vitest";
import { createLogger } from "../../../src/host/logger.ts";
import { attachRpcTraceLogging } from "../../../src/host/rpc-trace-logger.ts";
import type { PiRpcProcessManager, ProcessEvent } from "../../../src/host/process-manager.ts";

describe("attachRpcTraceLogging", () => {
  it("logs every outbound and inbound rpc payload at info level by default", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "info",
      write(line) {
        lines.push(line);
      },
      now: () => new Date("2026-05-26T15:00:00.000Z"),
    });
    const harness = createProcessManagerHarness();

    const unsubscribe = attachRpcTraceLogging(harness.manager, logger);
    harness.emit({
      type: "rpc_command_sent",
      id: "rpc-1",
      command: "prompt",
      payload: {
        type: "prompt",
        id: "rpc-1",
        message: "看一下这张图",
      },
    });
    harness.emit({
      type: "message_update",
      responseId: "resp-1",
      message: {
        role: "assistant",
        responseId: "resp-1",
        content: [{ type: "text", text: "我先看一下图片内容。" }],
      },
    });
    harness.emit({
      type: "rpc_response",
      id: "rpc-1",
      command: "prompt",
      success: true,
      payload: {
        type: "response",
        id: "rpc-1",
        command: "prompt",
        success: true,
        data: { accepted: true },
      },
    });
    unsubscribe();

    const entries = lines.map(parseLine);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      timestamp: "2026-05-26T15:00:00.000Z",
      level: "info",
      scope: "rpc",
      message: "rpc outbound",
      correlationId: "rpc-1",
      details: {
        type: "prompt",
        id: "rpc-1",
        message: "看一下这张图",
      },
    });
    expect(entries[1]).toMatchObject({
      timestamp: "2026-05-26T15:00:00.000Z",
      level: "info",
      scope: "rpc",
      message: "rpc inbound event: message_update",
      details: {
        type: "message_update",
        responseId: "resp-1",
      },
    });
    expect(entries[2]).toMatchObject({
      timestamp: "2026-05-26T15:00:00.000Z",
      level: "info",
      scope: "rpc",
      message: "rpc inbound response",
      correlationId: "rpc-1",
      details: {
        type: "response",
        id: "rpc-1",
        command: "prompt",
        success: true,
        data: { accepted: true },
      },
    });
  });
});

function createProcessManagerHarness(): {
  manager: PiRpcProcessManager;
  emit(event: ProcessEvent): void;
} {
  let listener: ((event: ProcessEvent) => void) | undefined;
  return {
    manager: {
      async start() {},
      async stop() {},
      async send() {
        throw new Error("not implemented");
      },
      onEvent(next) {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      isRunning() {
        return true;
      },
    },
    emit(event) {
      listener?.(event);
    },
  };
}

function parseLine(line: string | undefined): Record<string, unknown> {
  if (!line) throw new Error("Missing log line");
  return JSON.parse(line) as Record<string, unknown>;
}
