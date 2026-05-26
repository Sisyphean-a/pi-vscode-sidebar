import { describe, expect, it, vi } from "vitest";
import { createSidebarController } from "../../../src/host/controller.ts";
import type { ProcessEvent } from "../../../src/host/process-manager.ts";
import type { RecentSessionSummary } from "../../../src/shared/recent-sessions.ts";

function createHarness(options?: {
  phase?: "idle" | "streaming" | "awaiting_extension_ui" | "process_dead";
  extensionUiTimeoutMs?: number;
  recentSessions?: RecentSessionSummary[];
}) {
  const emitted: unknown[] = [];
  let listener: ((event: ProcessEvent) => void) | undefined;
  const sentCommands: unknown[] = [];
  const sentUiResponses: unknown[] = [];
  let ensureStartedCalls = 0;
  let phase = options?.phase ?? "idle";

  const controller = createSidebarController({
    processManager: {
      async start() {},
      async stop() {},
      isRunning() {
        return true;
      },
      async send(command) {
        sentCommands.push(command);
        return { type: "response", command: command.type, success: true };
      },
      onEvent(fn) {
        listener = fn;
        return () => {
          listener = undefined;
        };
      },
    },
    rpcClient: {
      async send(command) {
        sentCommands.push(command);
        return { type: "response", command: command.type, success: true, data: { ok: true } };
      },
      async sendExtensionUiResponse(response) {
        sentUiResponses.push(response);
        return { type: "response", command: "extension_ui_response", success: true };
      },
      async getState() {
        return {
          thinkingLevel: "medium",
          isStreaming: false,
          sessionId: "session-1",
          messageCount: 1,
          pendingMessageCount: 0,
        };
      },
    },
    stateStore: {
      snapshot() {
        return { phase, updatedAt: Date.now() };
      },
      markIdle() {
        phase = "idle";
        return { phase, updatedAt: Date.now() };
      },
      markStreaming() {
        phase = "streaming";
        return { phase, updatedAt: Date.now() };
      },
      markAwaitingExtensionUi() {
        phase = "awaiting_extension_ui";
        return { phase, updatedAt: Date.now() };
      },
      markProcessDead(error) {
        phase = "process_dead";
        return { phase, updatedAt: Date.now(), lastError: error };
      },
    },
    async ensureStarted() {
      ensureStartedCalls += 1;
    },
    extensionUiTimeoutMs: options?.extensionUiTimeoutMs,
    async listRecentSessions() {
      return options?.recentSessions ?? [];
    },
  });

  controller.connect((message) => {
    emitted.push(message);
  });

  return {
    controller,
    emitted,
    sentCommands,
    sentUiResponses,
    getEnsureStartedCalls() {
      return ensureStartedCalls;
    },
    emitProcessEvent(event: ProcessEvent) {
      listener?.(event);
    },
  };
}

describe("SidebarController", () => {
  it("forwards extension_ui_request events to the webview sink", async () => {
    const harness = createHarness();

    harness.emitProcessEvent({
      type: "extension_ui_request",
      id: "req-1",
      method: "input",
      title: "Need input",
    });

    const requestMessage = harness.emitted.find(
      (item) =>
        typeof item === "object" &&
        item &&
        (item as { type: string }).type === "extension_ui_request",
    ) as { type: string; data: { id: string } } | undefined;

    expect(requestMessage?.data.id).toBe("req-1");
  });

  it("forwards rpc command and response events to the webview sink", async () => {
    const harness = createHarness();

    harness.emitProcessEvent({
      type: "rpc_command_sent",
      id: "rpc-1",
      command: "prompt",
    });
    harness.emitProcessEvent({
      type: "rpc_response",
      id: "rpc-1",
      command: "prompt",
      success: true,
    });

    const forwardedEvents = harness.emitted.filter(
      (item) => typeof item === "object" && item && (item as { type?: string }).type === "event",
    ) as Array<{ data?: { type?: string; command?: string } }>;

    expect(forwardedEvents.some((item) => item.data?.type === "rpc_command_sent")).toBe(true);
    expect(forwardedEvents.some((item) => item.data?.type === "rpc_response")).toBe(true);
  });

  it("normalizes extension ui response payload and sends it to RPC", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({
      type: "respond_extension_ui",
      requestId: "req-2",
      payload: true,
    });

    expect(harness.sentUiResponses).toEqual([
      { type: "extension_ui_response", id: "req-2", confirmed: true },
    ]);
  });

  it("emits query result events for command responses", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({ type: "get_available_models" });

    const hasQueryResult = harness.emitted.some(
      (item) =>
        typeof item === "object" &&
        item &&
        (item as { type: string }).type === "event" &&
        (item as { data?: { type?: string } }).data?.type === "query_result",
    );

    expect(hasQueryResult).toBe(true);
  });

  it("emits query result after set_thinking_level command succeeds", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({ type: "set_thinking_level", level: "xhigh" });

    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          item &&
          (item as { type?: string }).type === "event" &&
          (item as { data?: { type?: string; command?: string } }).data?.type === "query_result" &&
          (item as { data?: { type?: string; command?: string } }).data?.command ===
            "set_thinking_level",
      ),
    ).toBe(true);
  });

  it("uses ui correlationId as rpc command id", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({
      type: "get_available_models",
      correlationId: "ui-correlation-1",
    });

    expect(harness.sentCommands).toContainEqual({
      type: "get_available_models",
      id: "ui-correlation-1",
    });
  });

  it("starts runtime and replays session messages when ui becomes ready", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({
      type: "ui_ready",
      correlationId: "ui-ready-1",
    });

    expect(harness.getEnsureStartedCalls()).toBe(1);
    expect(harness.sentCommands).toContainEqual({ type: "get_messages", id: "ui-ready-1" });
    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          !!item &&
          (item as { type?: string }).type === "event" &&
          (item as { data?: { type?: string; command?: string; replace?: boolean } }).data?.type ===
            "query_result" &&
          (item as { data?: { type?: string; command?: string; replace?: boolean } }).data
            ?.command === "get_messages" &&
          (item as { data?: { type?: string; command?: string; replace?: boolean } }).data
            ?.replace === true,
      ),
    ).toBe(true);
  });

  it("includes recent session summaries in state payloads", async () => {
    const harness = createHarness({
      recentSessions: [
        {
          sessionId: "session-2",
          sessionPath: "C:\\sessions\\session-2.jsonl",
          title: "修复最近任务列表",
          updatedAt: "2026-05-26T02:30:00.000Z",
        },
      ],
    });

    await harness.controller.handleUiMessage({
      type: "ui_ready",
      correlationId: "ui-ready-recent",
    });

    const stateMessage = [...harness.emitted]
      .reverse()
      .find(
        (item) =>
          typeof item === "object" && !!item && (item as { type?: string }).type === "state",
      ) as { data?: { recentSessions?: RecentSessionSummary[] } } | undefined;

    expect(stateMessage?.data?.recentSessions).toEqual([
      {
        sessionId: "session-2",
        sessionPath: "C:\\sessions\\session-2.jsonl",
        title: "修复最近任务列表",
        updatedAt: "2026-05-26T02:30:00.000Z",
      },
    ]);
  });

  it("replays session messages after switch_session command", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({
      type: "switch_session",
      sessionPath: "C:\\sessions\\session-1.json",
      correlationId: "switch-1",
    });

    expect(harness.sentCommands).toContainEqual({
      type: "switch_session",
      sessionPath: "C:\\sessions\\session-1.json",
      id: "switch-1",
    });
    expect(harness.sentCommands).toContainEqual({ type: "get_messages", id: "switch-1" });
  });

  it("forwards rpc stderr events as visible errors", async () => {
    const harness = createHarness();

    harness.emitProcessEvent({ type: "stderr", message: "rpc failed" });

    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          item &&
          (item as { type?: string; scope?: string; message?: string }).type === "error" &&
          (item as { type?: string; scope?: string; message?: string }).scope === "rpc" &&
          (item as { type?: string; scope?: string; message?: string }).message === "rpc failed",
      ),
    ).toBe(true);
  });

  it("blocks prompt command while streaming", async () => {
    const harness = createHarness({ phase: "streaming" });

    await harness.controller.handleUiMessage({ type: "send_prompt", text: "hello" });

    expect(harness.sentCommands).toEqual([]);
    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          item &&
          (item as { type?: string; scope?: string }).type === "error" &&
          (item as { type?: string; scope?: string }).scope === "ui",
      ),
    ).toBe(true);
  });

  it("does not block prompt after non-blocking extension ui notify event", async () => {
    const harness = createHarness();

    harness.emitProcessEvent({
      type: "extension_ui_request",
      id: "req-notify",
      method: "notify",
      message: "Heads up",
    });

    await harness.controller.handleUiMessage({ type: "send_prompt", text: "hello" });

    expect(harness.sentCommands).toContainEqual({
      type: "prompt",
      message: "hello",
      images: undefined,
    });
    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          item &&
          (item as { type?: string; scope?: string }).type === "error" &&
          (item as { type?: string; scope?: string }).scope === "ui",
      ),
    ).toBe(false);
  });

  it("keeps prompt blocked while waiting for blocking extension ui input", async () => {
    const harness = createHarness();

    harness.emitProcessEvent({
      type: "extension_ui_request",
      id: "req-input",
      method: "input",
      title: "Need input",
    });

    await harness.controller.handleUiMessage({ type: "send_prompt", text: "hello" });

    expect(harness.sentCommands).toEqual([]);
    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          item &&
          (item as { type?: string; scope?: string }).type === "error" &&
          (item as { type?: string; scope?: string }).scope === "ui",
      ),
    ).toBe(true);
  });

  it("auto-cancels extension ui request after timeout", async () => {
    vi.useFakeTimers();
    const harness = createHarness({ extensionUiTimeoutMs: 10 });

    harness.emitProcessEvent({
      type: "extension_ui_request",
      id: "req-timeout",
      method: "input",
      title: "Need input",
    });

    await vi.advanceTimersByTimeAsync(1200);

    expect(harness.sentUiResponses).toEqual([
      { type: "extension_ui_response", id: "req-timeout", cancelled: true },
    ]);
    vi.useRealTimers();
  });
});
