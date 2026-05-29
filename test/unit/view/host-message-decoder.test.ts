import { describe, expect, it } from "vitest";
import {
  decodeHostEventPayload,
  decodeHostStatePayload,
} from "../../../src/view/webview/host/message-decoder.ts";

describe("webview host message decoder", () => {
  it("decodes thinking level changed event", () => {
    expect(
      decodeHostEventPayload({
        type: "thinking_level_changed",
        level: "high",
      }),
    ).toEqual({
      kind: "thinking_level_changed",
      level: "high",
    });
  });

  it("decodes query_result event and preserves payload", () => {
    expect(
      decodeHostEventPayload({
        type: "query_result",
        command: "set_model",
        data: { ok: true },
      }),
    ).toEqual({
      kind: "query_result",
      event: {
        type: "query_result",
        command: "set_model",
        data: { ok: true },
      },
    });
  });

  it("decodes other host events as passthrough records", () => {
    expect(
      decodeHostEventPayload({
        type: "message_update",
        responseId: "resp-1",
      }),
    ).toEqual({
      kind: "other",
      event: {
        type: "message_update",
        responseId: "resp-1",
      },
    });
  });

  it("rejects invalid host events", () => {
    expect(decodeHostEventPayload("bad")).toBeUndefined();
    expect(
      decodeHostEventPayload({
        type: "query_result",
      }),
    ).toBeUndefined();
  });

  it("decodes host state payload", () => {
    expect(
      decodeHostStatePayload({
        view: { phase: "idle" },
        rpc: { model: { provider: "openai", id: "gpt-5" } },
      }),
    ).toEqual({
      rpc: { model: { provider: "openai", id: "gpt-5" } },
      state: {
        view: { phase: "idle" },
        rpc: { model: { provider: "openai", id: "gpt-5" } },
      },
    });
  });

  it("rejects invalid host state payload", () => {
    expect(decodeHostStatePayload("bad")).toBeUndefined();
  });
});
