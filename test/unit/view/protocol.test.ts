import { describe, expect, it } from "vitest";

import { parseHostMessage, parseUiMessage } from "../../../src/view/protocol.ts";

describe("view protocol parsing", () => {
  it("parses valid ui messages and preserves non-empty correlationId", () => {
    expect(
      parseUiMessage({
        type: "run_command",
        name: "compact",
        rawInput: "/compact",
        correlationId: "run-1",
      }),
    ).toEqual({
      type: "run_command",
      name: "compact",
      rawInput: "/compact",
      correlationId: "run-1",
    });
  });

  it("ignores empty correlationId while keeping the message payload", () => {
    expect(
      parseUiMessage({
        type: "send_prompt",
        text: "hello",
        correlationId: "",
      }),
    ).toEqual({
      type: "send_prompt",
      text: "hello",
    });
  });

  it("ignores non-string correlationId while keeping the message payload", () => {
    expect(
      parseUiMessage({
        type: "send_prompt",
        text: "hello",
        correlationId: 1,
      }),
    ).toEqual({
      type: "send_prompt",
      text: "hello",
    });
  });

  it("rejects invalid ui message payloads", () => {
    expect(parseUiMessage({ type: "run_command", name: "compact", rawInput: "" })).toBeUndefined();
    expect(
      parseUiMessage({ type: "open_file_reference", path: "a.ts", startLine: "1" }),
    ).toBeUndefined();
  });

  it("parses host command ui requests with structured data", () => {
    expect(
      parseHostMessage({
        type: "command_ui_request",
        data: {
          id: "req-1",
          kind: "model_list",
          items: [{ id: "item-1", label: "GPT-5", active: true }],
        },
      }),
    ).toEqual({
      type: "command_ui_request",
      data: {
        id: "req-1",
        kind: "model_list",
        items: [{ id: "item-1", label: "GPT-5", active: true }],
      },
    });
  });

  it("rejects extension ui request payloads that are not objects", () => {
    expect(
      parseHostMessage({
        type: "extension_ui_request",
        data: "invalid",
      }),
    ).toBeUndefined();
  });

  it("rejects malformed host messages", () => {
    expect(
      parseHostMessage({
        type: "command_ui_request",
        data: {
          id: "req-1",
          kind: "model_list",
          items: [{ id: "item-1", label: 123 }],
        },
      }),
    ).toBeUndefined();
    expect(parseHostMessage({ type: "notice", message: "" })).toBeUndefined();
  });
});
