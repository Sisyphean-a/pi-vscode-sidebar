import { describe, expect, it } from "vitest";
import { createSidebarController } from "../../src/host/controller.ts";
import type { ProcessEvent } from "../../src/host/process-manager.ts";

describe("sidebar controller integration flow", () => {
  it("handles prompt stream, tool lifecycle events, and session switch", async () => {
    const emitted: unknown[] = [];
    const sentCommands: Array<{ type: string }> = [];
    const sentUiResponses: Array<{ type: string; id: string }> = [];
    let processListener: ((event: ProcessEvent) => void) | undefined;
    let phase: "idle" | "streaming" | "awaiting_extension_ui" | "process_dead" = "idle";

    const controller = createSidebarController({
      processManager: {
        async start() {},
        async stop() {},
        isRunning() {
          return true;
        },
        async send(command) {
          sentCommands.push({ type: command.type });
          return { type: "response", command: command.type, success: true };
        },
        onEvent(listener) {
          processListener = listener;
          return () => {
            processListener = undefined;
          };
        },
      },
      rpcClient: {
        async send(command) {
          sentCommands.push({ type: command.type });
          return { type: "response", command: command.type, success: true };
        },
        async sendExtensionUiResponse(response) {
          sentUiResponses.push({ type: response.type, id: response.id });
          return { type: "response", command: "extension_ui_response", success: true };
        },
        async getState() {
          return {
            thinkingLevel: "medium",
            isStreaming: phase === "streaming",
            sessionId: "session-1",
            sessionFile: "C:\\sessions\\session-1.json",
            messageCount: 2,
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
      async ensureStarted() {},
    });

    controller.connect((message) => {
      emitted.push(message);
    });

    await controller.handleUiMessage({ type: "send_prompt", text: "hello" });
    processListener?.({ type: "message_update", text: "Hi" });
    processListener?.({ type: "tool_execution_start", toolName: "vscode_get_editor_state" });
    processListener?.({ type: "tool_execution_end", toolName: "vscode_get_editor_state" });
    processListener?.({
      type: "extension_ui_request",
      id: "req-1",
      method: "input",
      title: "Need input",
    });
    processListener?.({
      type: "extension_ui_request",
      id: "req-2",
      method: "notify",
      message: "Heads up",
    });
    processListener?.({
      type: "extension_ui_request",
      id: "req-3",
      method: "setStatus",
      statusKey: "busy",
      statusText: "Working",
    });
    processListener?.({
      type: "extension_ui_request",
      id: "req-4",
      method: "setTitle",
      title: "Session A",
    });
    processListener?.({
      type: "extension_ui_request",
      id: "req-5",
      method: "set_editor_text",
      text: "draft",
    });
    await controller.handleUiMessage({
      type: "respond_extension_ui",
      requestId: "req-1",
      payload: "approved",
    });
    processListener?.({ type: "agent_end" });
    processListener?.({ type: "process_exit", code: 1, signal: null });
    await controller.handleUiMessage({
      type: "switch_session",
      sessionPath: "C:\\sessions\\session-1.json",
    });

    const commandTypes = sentCommands.map((entry) => entry.type);
    expect(commandTypes).toContain("prompt");
    expect(commandTypes).toContain("switch_session");
    expect(sentUiResponses).toEqual([{ type: "extension_ui_response", id: "req-1" }]);
    expect(emitted.some((entry) => hasType(entry, "event"))).toBe(true);
    expect(emitted.some((entry) => hasStatePhase(entry, "idle"))).toBe(true);
    expect(emitted.some((entry) => hasStatePhase(entry, "process_dead"))).toBe(true);
    expect(hasExtensionUiMethod(emitted, "notify")).toBe(true);
    expect(hasExtensionUiMethod(emitted, "setStatus")).toBe(true);
    expect(hasExtensionUiMethod(emitted, "setTitle")).toBe(true);
    expect(hasExtensionUiMethod(emitted, "set_editor_text")).toBe(true);
  });
});

function hasType(payload: unknown, type: string): boolean {
  return typeof payload === "object" && !!payload && (payload as { type?: string }).type === type;
}

function hasStatePhase(payload: unknown, phase: string): boolean {
  if (!hasType(payload, "state")) return false;
  const data = (payload as { data?: { view?: { phase?: string } } }).data;
  return data?.view?.phase === phase;
}

function hasExtensionUiMethod(payloads: unknown[], method: string): boolean {
  return payloads.some((payload) => {
    if (!hasType(payload, "extension_ui_request")) return false;
    const data = (payload as { data?: { method?: string } }).data;
    return data?.method === method;
  });
}
