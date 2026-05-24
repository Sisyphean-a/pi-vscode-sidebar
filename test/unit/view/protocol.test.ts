import { describe, expect, it } from "vitest";
import { parseUiMessage } from "../../../src/view/protocol.ts";

describe("parseUiMessage", () => {
  it("accepts send_prompt with text", () => {
    const parsed = parseUiMessage({
      type: "send_prompt",
      text: "hello",
      images: [{ path: "a.png" }],
    });

    expect(parsed).toEqual({
      type: "send_prompt",
      text: "hello",
      images: [{ path: "a.png" }],
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseUiMessage({})).toBeUndefined();
    expect(parseUiMessage({ type: "send_prompt" })).toBeUndefined();
    expect(parseUiMessage({ type: "unknown" })).toBeUndefined();
    expect(parseUiMessage("not-an-object")).toBeUndefined();
  });
});
