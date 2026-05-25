import { describe, expect, it } from "vitest";
import {
  buildPromptReferencePayload,
  formatPromptReferenceToken,
} from "../../../src/view/editor-reference.ts";

describe("editor reference helpers", () => {
  it("formats prompt reference token", () => {
    expect(formatPromptReferenceToken("src/pi/env.ts", 11, 23)).toBe("@src/pi/env.ts:11-23");
    expect(formatPromptReferenceToken("src/pi/env.ts", 11)).toBe("@src/pi/env.ts:11");
  });

  it("builds inclusive end line for multi-line selections", () => {
    const payload = buildPromptReferencePayload({
      documentText: "a\nb\nc\nd\n",
      end: { character: 0, line: 3 },
      languageId: "typescript",
      path: "src/pi/env.ts",
      selectedText: "b\nc\n",
      start: { character: 0, line: 1 },
    });

    expect(payload).toMatchObject({
      reference: "@src/pi/env.ts:2-3",
      path: "src/pi/env.ts",
      startLine: 2,
      endLine: 3,
      language: "typescript",
      content: "b\nc\n",
    });
  });
});
