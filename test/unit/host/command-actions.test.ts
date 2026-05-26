import { describe, expect, it } from "vitest";
import { createSidebarController } from "../../../src/host/controller.ts";
import type { ProcessEvent } from "../../../src/host/process-manager.ts";

function createHarness(commandData?: Partial<Record<string, unknown>>) {
  const emitted: unknown[] = [];
  const sentCommands: unknown[] = [];
  let listener: ((event: ProcessEvent) => void) | undefined;

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
        return {
          type: "response",
          command: command.type,
          success: true,
          data: commandData?.[command.type] ?? { ok: true },
        };
      },
      async sendExtensionUiResponse() {
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
        return { phase: "idle" as const, updatedAt: Date.now() };
      },
      markIdle() {
        return { phase: "idle" as const, updatedAt: Date.now() };
      },
      markStreaming() {
        return { phase: "streaming" as const, updatedAt: Date.now() };
      },
      markAwaitingExtensionUi() {
        return { phase: "awaiting_extension_ui" as const, updatedAt: Date.now() };
      },
      markProcessDead(error) {
        return { phase: "process_dead" as const, updatedAt: Date.now(), lastError: error };
      },
    },
    async ensureStarted() {},
  });

  controller.connect((message) => {
    emitted.push(message);
  });

  return { controller, emitted, sentCommands, emitProcessEvent: listener };
}

describe("sidebar command actions", () => {
  it("routes /name to set_session_name", async () => {
    const harness = createHarness();

    await harness.controller.handleUiMessage({
      type: "run_command",
      name: "name",
      rawInput: "/name command title",
    });

    expect(harness.sentCommands).toContainEqual({
      type: "set_session_name",
      name: "command title",
    });
  });

  it("opens model selection and sends set_model after selection", async () => {
    const harness = createHarness({
      get_available_models: {
        models: [{ provider: "openai", id: "gpt-5", name: "GPT-5" }],
      },
    });

    await harness.controller.handleUiMessage({
      type: "run_command",
      name: "model",
      rawInput: "/model",
    });

    const request = harness.emitted.find(
      (item) =>
        typeof item === "object" &&
        !!item &&
        (item as { type?: string }).type === "command_ui_request",
    ) as { data?: { id?: string; kind?: string } } | undefined;

    expect(request?.data?.kind).toBe("model_list");

    await harness.controller.handleUiMessage({
      type: "respond_command_ui",
      requestId: request?.data?.id ?? "",
      payload: { provider: "openai", modelId: "gpt-5" },
    });

    expect(harness.sentCommands).toContainEqual({
      type: "set_model",
      provider: "openai",
      modelId: "gpt-5",
    });
  });

  it("emits copy result from /copy", async () => {
    const harness = createHarness({
      get_last_assistant_text: {
        text: "latest assistant answer",
      },
    });

    await harness.controller.handleUiMessage({
      type: "run_command",
      name: "copy",
      rawInput: "/copy",
    });

    expect(harness.sentCommands).toContainEqual({ type: "get_last_assistant_text" });
    expect(
      harness.emitted.some(
        (item) =>
          typeof item === "object" &&
          !!item &&
          (item as { type?: string }).type === "command_result" &&
          (item as { data?: { copyText?: string } }).data?.copyText === "latest assistant answer",
      ),
    ).toBe(true);
  });

  it("opens tree selection and sends navigate_session_tree after selection", async () => {
    const harness = createHarness({
      get_session_tree: {
        nodes: [
          {
            entryId: "node-1",
            previewText: "Root",
            depth: 0,
            isActive: true,
            hasChildren: true,
          },
        ],
      },
    });

    await harness.controller.handleUiMessage({
      type: "run_command",
      name: "tree",
      rawInput: "/tree",
    });

    const request = harness.emitted.find(
      (item) =>
        typeof item === "object" &&
        !!item &&
        (item as { type?: string }).type === "command_ui_request",
    ) as { data?: { id?: string; kind?: string } } | undefined;

    expect(request?.data?.kind).toBe("session_tree");

    await harness.controller.handleUiMessage({
      type: "respond_command_ui",
      requestId: request?.data?.id ?? "",
      payload: { selectedId: "node-1" },
    });

    expect(harness.sentCommands).toContainEqual({ type: "get_session_tree" });
    expect(harness.sentCommands).toContainEqual({
      type: "navigate_session_tree",
      entryId: "node-1",
    });
  });

  it("routes dynamic slash commands through prompt after loading get_commands", async () => {
    const harness = createHarness({
      get_commands: {
        commands: [
          {
            name: "cg-status",
            description: "Show CodeGraph status",
            source: "extension",
            sourceInfo: {
              path: "E:\\github\\pi\\.pi\\extensions\\codegraph.ts",
              source: "local",
              scope: "user",
              origin: "top-level",
            },
          },
        ],
      },
    });

    await harness.controller.handleUiMessage({
      type: "run_command",
      name: "cg-status",
      rawInput: "/cg-status",
    });

    expect(harness.sentCommands).toContainEqual({ type: "get_commands" });
    expect(harness.sentCommands).toContainEqual({
      type: "prompt",
      message: "/cg-status",
      images: undefined,
    });
  });
});
