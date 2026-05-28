import { describe, expect, it } from "vitest";
import { interpretProcessPayload } from "../../../src/host/process-manager-payloads.ts";

describe("interpretProcessPayload", () => {
  it("marks id-less rpc responses for direct event emission", () => {
    expect(
      interpretProcessPayload({
        type: "response",
        command: "prompt",
        success: true,
        data: { ok: true },
      }),
    ).toEqual({
      type: "rpc_response",
      id: undefined,
      command: "prompt",
      success: true,
      payload: {
        type: "response",
        command: "prompt",
        success: true,
        data: { ok: true },
      },
      resolveId: undefined,
      emitPayloadDirectly: true,
    });
  });

  it("marks id-bound rpc responses for pending resolution", () => {
    expect(
      interpretProcessPayload({
        type: "response",
        id: "req-1",
        command: "prompt",
        success: true,
      }),
    ).toEqual({
      type: "rpc_response",
      id: "req-1",
      command: "prompt",
      success: true,
      payload: {
        type: "response",
        id: "req-1",
        command: "prompt",
        success: true,
      },
      resolveId: "req-1",
      emitPayloadDirectly: false,
    });
  });

  it("passes through agent and extension ui events, and reports unknown payloads as stderr", () => {
    expect(
      interpretProcessPayload({
        type: "extension_ui_request",
        id: "req-ui-1",
        method: "notify",
        message: "hello",
      }),
    ).toEqual({
      type: "output",
      payload: {
        type: "extension_ui_request",
        id: "req-ui-1",
        method: "notify",
        message: "hello",
      },
    });

    expect(
      interpretProcessPayload({
        type: "thinking_level_changed",
        level: "high",
      }),
    ).toEqual({
      type: "output",
      payload: {
        type: "thinking_level_changed",
        level: "high",
      },
    });

    expect(interpretProcessPayload({ hello: "world" })).toEqual({
      type: "stderr",
      message: 'Unknown RPC payload: {"hello":"world"}',
    });
  });

  it("treats malformed rpc-like payloads as stderr", () => {
    expect(
      interpretProcessPayload({
        type: "response",
        command: "prompt",
      }),
    ).toEqual({
      type: "stderr",
      message: 'Unknown RPC payload: {"type":"response","command":"prompt"}',
    });

    expect(
      interpretProcessPayload({
        type: "extension_ui_request",
        id: "req-ui-2",
      }),
    ).toEqual({
      type: "stderr",
      message: 'Unknown RPC payload: {"type":"extension_ui_request","id":"req-ui-2"}',
    });
  });
});
