import { describe, expect, it, vi } from "vitest";

import { dispatchProcessPayload } from "../../../src/host/process-manager-dispatch.ts";
import type { ProcessEvent } from "../../../src/host/process-manager.ts";
import type { RpcResponse } from "../../../src/shared/rpc-types.ts";

describe("dispatchProcessPayload", () => {
  it("emits rpc_response events and resolves pending requests for id-bound responses", () => {
    const events: ProcessEvent[] = [];
    const resolvePending = vi.fn();
    const payload: RpcResponse = {
      type: "response",
      id: "req-1",
      command: "prompt",
      success: true,
      data: { ok: true },
    };

    dispatchProcessPayload(payload, {
      emit(event) {
        events.push(event);
      },
      resolvePending,
    });

    expect(events).toEqual([
      {
        type: "rpc_response",
        id: "req-1",
        command: "prompt",
        success: true,
        payload,
      },
    ]);
    expect(resolvePending).toHaveBeenCalledWith("req-1", payload);
  });

  it("re-emits id-less rpc responses directly to subscribers", () => {
    const events: ProcessEvent[] = [];
    const payload: RpcResponse = {
      type: "response",
      command: "prompt",
      success: true,
      data: { echoed: true },
    };

    dispatchProcessPayload(payload, {
      emit(event) {
        events.push(event);
      },
      resolvePending: vi.fn(),
    });

    expect(events).toEqual([
      {
        type: "rpc_response",
        id: undefined,
        command: "prompt",
        success: true,
        payload,
      },
      payload,
    ]);
  });

  it("emits non-response output payloads and unknown payloads as stderr", () => {
    const events: ProcessEvent[] = [];

    dispatchProcessPayload(
      {
        type: "thinking_level_changed",
        level: "high",
      },
      {
        emit(event) {
          events.push(event);
        },
        resolvePending: vi.fn(),
      },
    );

    dispatchProcessPayload(
      { unexpected: true },
      {
        emit(event) {
          events.push(event);
        },
        resolvePending: vi.fn(),
      },
    );

    expect(events[0]).toEqual({
      type: "thinking_level_changed",
      level: "high",
    });
    expect(events[1]).toEqual({
      type: "stderr",
      message: 'Unknown RPC payload: {"unexpected":true}',
    });
  });
});
