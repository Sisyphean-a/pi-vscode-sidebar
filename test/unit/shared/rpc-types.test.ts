import { describe, expect, it } from "vitest";

import {
  isAgentEventLike,
  isRpcExtensionUiRequest,
  isRpcResponse,
} from "../../../src/shared/rpc-types.ts";

describe("rpc type guards", () => {
  it("accepts well-formed rpc response payloads", () => {
    expect(
      isRpcResponse({
        type: "response",
        id: "req-1",
        command: "prompt",
        success: true,
      }),
    ).toBe(true);
    expect(
      isRpcResponse({
        type: "response",
        command: "prompt",
        success: false,
        error: "boom",
      }),
    ).toBe(true);
  });

  it("rejects malformed rpc response payloads", () => {
    expect(isRpcResponse({ type: "response", command: "prompt" })).toBe(false);
    expect(isRpcResponse({ type: "response", command: "prompt", success: false })).toBe(false);
    expect(isRpcResponse({ type: "response", command: "prompt", success: "yes" })).toBe(false);
  });

  it("accepts and rejects extension ui request payloads by schema", () => {
    expect(
      isRpcExtensionUiRequest({
        type: "extension_ui_request",
        id: "req-ui-1",
        method: "confirm",
        title: "确认",
        message: "继续吗",
      }),
    ).toBe(true);
    expect(
      isRpcExtensionUiRequest({
        type: "extension_ui_request",
        id: "req-ui-1",
      }),
    ).toBe(false);
  });

  it("accepts only known agent event types", () => {
    expect(isAgentEventLike({ type: "thinking_level_changed", level: "high" })).toBe(true);
    expect(isAgentEventLike({ type: "unknown_event" })).toBe(false);
  });
});
