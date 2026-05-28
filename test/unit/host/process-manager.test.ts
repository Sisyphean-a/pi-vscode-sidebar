import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJsonlFramer,
  createPendingRequestStore,
  createPiRpcProcessManager,
} from "../../../src/host/process/manager.ts";
import type { ProcessEvent } from "../../../src/host/process/manager.ts";
import { isAgentEventLike } from "../../../src/shared/rpc-types.ts";

describe("createJsonlFramer", () => {
  it("parses complete lines and preserves partial tails", () => {
    const framer = createJsonlFramer();

    expect(framer.push('{"type":"a"}\n{"type":"b"')).toEqual([{ type: "a" }]);
    expect(framer.push(',"ok":true}\n')).toEqual([{ type: "b", ok: true }]);
  });

  it("throws for malformed JSON line", () => {
    const framer = createJsonlFramer();
    expect(() => framer.push("{invalid}\n")).toThrowError("Invalid JSONL payload");
  });
});

describe("createPendingRequestStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("rejects request promise when timeout is reached", async () => {
    const store = createPendingRequestStore();
    const promise = store.register("req-1", 100);
    const rejection = expect(promise).rejects.toThrowError("RPC timeout for request req-1");

    await vi.advanceTimersByTimeAsync(120);
    await rejection;
  });

  it("resolves request promise when response arrives in time", async () => {
    const store = createPendingRequestStore();
    const promise = store.register("req-2", 1000);

    store.resolve("req-2", { ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
  });
});

describe("createPiRpcProcessManager", () => {
  it("recognizes thinking_level_changed as an agent event", () => {
    expect(isAgentEventLike({ type: "thinking_level_changed", level: "high" })).toBe(true);
  });

  it("recognizes session_info_changed as an agent event", () => {
    expect(isAgentEventLike({ type: "session_info_changed", name: "查询样式配置位置" })).toBe(true);
  });

  it("fails fast when pi binary is missing", async () => {
    const manager = createPiRpcProcessManager();
    const events: Array<{ type: string; message?: string }> = [];
    manager.onEvent((event) => {
      if (event.type === "stderr") {
        events.push(event);
      }
    });

    const missingPath =
      process.platform === "win32"
        ? "Z:\\__pi_sidebar_missing__\\pi.exe"
        : "/__pi_sidebar_missing__/pi";

    await expect(
      manager.start({
        executable: missingPath,
        args: ["--mode", "rpc"],
      }),
    ).rejects.toThrowError();

    expect(events.length).toBeGreaterThan(0);
    expect(manager.isRunning()).toBe(false);
  });

  it("emits full outbound and inbound rpc payloads for each request", async () => {
    const manager = createPiRpcProcessManager();
    const events: ProcessEvent[] = [];
    manager.onEvent((event) => {
      events.push(event);
    });

    await manager.start({
      executable: process.execPath,
      args: ["-e", createEchoRpcServerScript()],
    });

    const response = await manager.send({ type: "prompt", message: "图片里是哪段代码？" }, 1000);
    await manager.stop();

    expect(response).toMatchObject({
      type: "response",
      command: "prompt",
      success: true,
    });

    const sentEvent = events.find(
      (event): event is Extract<ProcessEvent, { type: "rpc_command_sent" }> =>
        event.type === "rpc_command_sent",
    );
    expect(sentEvent).toBeDefined();
    if (!sentEvent) throw new Error("Missing rpc_command_sent event");

    expect(sentEvent.payload).toEqual({
      type: "prompt",
      message: "图片里是哪段代码？",
      id: sentEvent.id,
    });

    const responseEvent = events.find(
      (event): event is Extract<ProcessEvent, { type: "rpc_response" }> =>
        event.type === "rpc_response",
    );
    expect(responseEvent).toBeDefined();
    if (!responseEvent) throw new Error("Missing rpc_response event");

    expect(responseEvent.payload).toEqual({
      type: "response",
      id: sentEvent.id,
      command: "prompt",
      success: true,
      data: {
        echoed: sentEvent.payload,
      },
    });
  });
});

function createEchoRpcServerScript(): string {
  return [
    "process.stdin.setEncoding('utf8');",
    "let buffer = '';",
    "process.stdin.on('data', (chunk) => {",
    "  buffer += chunk;",
    "  while (true) {",
    "    const newlineIndex = buffer.indexOf('\\n');",
    "    if (newlineIndex < 0) break;",
    "    const line = buffer.slice(0, newlineIndex).trim();",
    "    buffer = buffer.slice(newlineIndex + 1);",
    "    if (!line) continue;",
    "    const command = JSON.parse(line);",
    "    process.stdout.write(JSON.stringify({",
    "      type: 'response',",
    "      id: command.id,",
    "      command: command.type,",
    "      success: true,",
    "      data: { echoed: command },",
    "    }) + '\\n');",
    "  }",
    "});",
  ].join("");
}
