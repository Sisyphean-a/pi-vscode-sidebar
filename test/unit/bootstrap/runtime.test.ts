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
    createOutputChannel() {
      return { appendLine() {}, dispose() {} };
    },
  },
}));

describe("bootstrap runtime", () => {
  beforeEach(() => {
    vi.resetModules();
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
