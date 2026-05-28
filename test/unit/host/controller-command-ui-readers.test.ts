import { describe, expect, it } from "vitest";

import {
  readExportPath,
  readForkCommandUiItems,
  readLastAssistantText,
  readModelCommandUiItems,
  readModelSelection,
  readSelectedCommandUiId,
  readSlashCommands,
  readTreeCommandUiItems,
} from "../../../src/host/controller-command-ui-readers.ts";

describe("controller command ui readers", () => {
  it("reads model command ui items with provider detail and payload", () => {
    expect(
      readModelCommandUiItems({
        models: [
          { provider: "openai", id: "gpt-5", name: "GPT-5" },
          { provider: "anthropic", id: "claude-opus-4" },
          { provider: "", id: "invalid" },
        ],
      }),
    ).toEqual([
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        detail: "openai",
        payload: { provider: "openai", modelId: "gpt-5" },
      },
      {
        id: "anthropic/claude-opus-4",
        label: "claude-opus-4",
        detail: "anthropic",
        payload: { provider: "anthropic", modelId: "claude-opus-4" },
      },
    ]);
  });

  it("reads fork and tree items from rpc payloads", () => {
    expect(
      readForkCommandUiItems({
        messages: [
          {
            entryId: "entry-1",
            text: "first line\nsecond line",
          },
        ],
      }),
    ).toEqual([
      {
        id: "entry-1",
        label: "first line\nsecond line",
        payload: { selectedId: "entry-1" },
      },
    ]);

    expect(
      readTreeCommandUiItems({
        nodes: [
          {
            entryId: "node-1",
            label: "Current node",
            previewText: "preview",
            depth: 2,
            isActive: true,
          },
        ],
      }),
    ).toEqual([
      {
        id: "node-1",
        label: "Current node",
        detail: "preview",
        depth: 2,
        active: true,
        payload: { selectedId: "node-1" },
      },
    ]);

    expect(() =>
      readTreeCommandUiItems({
        nodes: [{ entryId: "node-invalid" }],
      }),
    ).not.toThrow();
    expect(
      readTreeCommandUiItems({
        nodes: [{ entryId: "node-invalid" }],
      }),
    ).toEqual([]);
  });

  it("reads command ui selections and slash command payloads", () => {
    expect(readSelectedCommandUiId("path-1")).toBe("path-1");
    expect(readSelectedCommandUiId({ selectedId: "path-2" })).toBe("path-2");
    expect(readSelectedCommandUiId({ selectedId: 42 })).toBeUndefined();

    expect(readModelSelection({ provider: "openai", modelId: "gpt-5" })).toEqual({
      provider: "openai",
      modelId: "gpt-5",
    });
    expect(readModelSelection({ provider: "openai" })).toBeUndefined();
    expect(readModelSelection("invalid")).toBeUndefined();

    expect(
      readSlashCommands({
        commands: [
          {
            name: "cg-status",
            source: "extension",
            sourceInfo: { scope: "user" },
          },
          {
            name: "broken",
            source: "extension",
          },
        ],
      }),
    ).toEqual([
      {
        name: "cg-status",
        source: "extension",
        sourceInfo: { scope: "user" },
      },
    ]);
  });

  it("reads last assistant text and export path from rpc payloads", () => {
    expect(readLastAssistantText({ text: "final answer" })).toBe("final answer");
    expect(readLastAssistantText({ text: "" })).toBeUndefined();
    expect(readExportPath({ path: "C:\\exports\\session.html" })).toBe("C:\\exports\\session.html");
    expect(readExportPath({ path: 42 })).toBeUndefined();
  });
});
