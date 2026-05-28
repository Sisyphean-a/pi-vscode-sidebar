import { describe, expect, it } from "vitest";
import {
  readToolArgsFromContent,
  readToolCallIdFromContent,
  readToolNameFromContent,
} from "../../../src/view/webview/activity-event-tool-call.ts";

describe("activity event tool-call readers", () => {
  it("reads tool args from text and object payloads", () => {
    expect(readToolArgsFromContent([{ type: "toolCall", partialArgs: '{"path":"a.ts"}' }])).toBe(
      '{"path":"a.ts"}',
    );

    expect(
      readToolArgsFromContent([{ type: "toolCall", args: { path: "a.ts", startLine: 1 } }]),
    ).toBe('{\n  "path": "a.ts",\n  "startLine": 1\n}');
  });

  it("reads tool id and name from toolCall content entry", () => {
    const content = [{ type: "toolCall", id: "tc-1", name: "read_file" }];
    expect(readToolCallIdFromContent(content)).toBe("tc-1");
    expect(readToolNameFromContent(content)).toBe("read_file");
  });
});
