import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJsonlFramer,
  createPendingRequestStore,
  createPiRpcProcessManager,
} from "../../../src/host/process-manager.ts";
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
});
