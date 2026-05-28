import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "E:/github/pi-vscode-sidebar" } }],
    getConfiguration() {
      return {
        get() {
          return undefined;
        },
      };
    },
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine() {}, dispose() {} })),
  },
}));

describe("bootstrap runtime", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("writes logs to the output channel and publishes the same line to the broadcaster", async () => {
    const output = { appendLine: vi.fn(), dispose: vi.fn() };
    const publish = vi.fn();
    const vscode = await import("vscode");
    (vscode.window.createOutputChannel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      output,
    );

    const { setupTraceLogging } = await import("../../../src/bootstrap/runtime.ts");

    const logger = setupTraceLogging(
      { subscriptions: [] } as never,
      { onEvent: vi.fn(() => () => {}) } as never,
      { publish },
    );
    logger.info({
      scope: "test",
      message: "hello",
      details: { ok: true },
    });

    expect(output.appendLine).toHaveBeenCalledTimes(2);
    const line = output.appendLine.mock.calls[1]?.[0];
    expect(typeof line).toBe("string");
    expect(JSON.parse(line)).toMatchObject({
      level: "info",
      scope: "test",
      message: "hello",
      details: { ok: true },
    });
    expect(publish).toHaveBeenCalledWith(line);
  });

  it("starts the rpc process and restores the pending session only once", async () => {
    const { createEnsureStarted } = await import("../../../src/bootstrap/runtime.ts");
    const start = vi.fn(async () => {});
    const send = vi.fn(async () => ({ success: true }));
    const restoreState = {
      pendingSession: "C:\\sessions\\session-1.jsonl",
      hasRestored: false,
    };

    const ensureStarted = createEnsureStarted({
      bridge: undefined,
      context: { extensionUri: { fsPath: "ext", path: "ext" } } as never,
      processManager: {
        isRunning: vi.fn(() => false),
        start,
      } as never,
      restoreState,
      rpcClient: {
        send,
      } as never,
    });

    await ensureStarted();
    await ensureStarted();

    expect(start).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: "switch_session",
      sessionPath: "C:\\sessions\\session-1.jsonl",
    });
    expect(restoreState.hasRestored).toBe(true);
  });
});
