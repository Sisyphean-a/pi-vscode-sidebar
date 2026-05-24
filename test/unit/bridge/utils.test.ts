import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class Position {
    line: number;
    character: number;

    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  }

  return {
    Position,
    Uri: {
      file(filePath: string) {
        return {
          fsPath: filePath,
          toString: () => `file://${filePath.replaceAll("\\", "/")}`,
        };
      },
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "C:\\workspace" } }],
    },
  };
});

import { readRequiredString, readWorkspaceEdits } from "../../../src/bridge/utils.ts";

describe("bridge parameter validation", () => {
  it("throws when required string is missing", () => {
    expect(() => readRequiredString(undefined, "filePath")).toThrowError(
      "Missing required parameter: filePath",
    );
  });

  it("throws when workspace edits are missing", () => {
    expect(() => readWorkspaceEdits(undefined)).toThrowError("Missing required parameter: edits");
  });

  it("throws when workspace edit range is invalid", () => {
    expect(() =>
      readWorkspaceEdits([
        {
          filePath: "a.ts",
          range: { start: { line: 0, character: 0 } },
        },
      ]),
    ).toThrowError("Invalid workspace edit range at index 0");
  });

  it("accepts a valid workspace edit payload", () => {
    const edits = readWorkspaceEdits([
      {
        filePath: "a.ts",
        range: {
          start: { line: 0, character: 1 },
          end: { line: 0, character: 3 },
        },
        newText: "ok",
      },
    ]);

    expect(edits).toEqual([
      {
        filePath: "a.ts",
        range: {
          start: { line: 0, character: 1 },
          end: { line: 0, character: 3 },
        },
        newText: "ok",
      },
    ]);
  });
});
