import { describe, expect, it } from "vitest";

import {
  readToolArgsFromContent,
  readToolCallIdFromContent,
  readToolNameFromContent,
} from "../../../src/view/webview/activity-event-tool-call.ts";

describe("activity event tool call", () => {
  it("reads tool args from toolCall content entries", () => {
    expect(
      readToolArgsFromContent([
        {
          type: "toolCall",
          args: { path: "src/app.ts", line: 12 },
        },
      ]),
    ).toBe('{\n  "path": "src/app.ts",\n  "line": 12\n}');
  });

  it("reads tool call id and name from the first toolCall content entry", () => {
    const content = [
      { type: "text", text: "ignored" },
      {
        type: "toolCall",
        id: "call-1",
        name: "read_file",
        partialArgs: "--help",
      },
      {
        type: "toolCall",
        id: "call-2",
        name: "edit_file",
      },
    ];

    expect(readToolCallIdFromContent(content)).toBe("call-1");
    expect(readToolNameFromContent(content)).toBe("read_file");
    expect(readToolArgsFromContent(content)).toBe("--help");
  });
});
