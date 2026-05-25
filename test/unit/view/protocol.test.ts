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

  it("accepts open_file_reference payload", () => {
    const parsed = parseUiMessage({
      type: "open_file_reference",
      path: "src/pi/env.ts",
      startLine: 11,
      endLine: 23,
    });

    expect(parsed).toEqual({
      type: "open_file_reference",
      path: "src/pi/env.ts",
      startLine: 11,
      endLine: 23,
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseUiMessage({})).toBeUndefined();
    expect(parseUiMessage({ type: "send_prompt" })).toBeUndefined();
    expect(parseUiMessage({ type: "unknown" })).toBeUndefined();
    expect(parseUiMessage("not-an-object")).toBeUndefined();
  });
});
