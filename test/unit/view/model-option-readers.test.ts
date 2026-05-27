import { describe, expect, it } from "vitest";

import { extractAvailableModels } from "../../../src/view/webview/model-option-readers.ts";

describe("model option readers", () => {
  it("reads available models from direct or nested data payloads", () => {
    expect(
      extractAvailableModels({
        data: {
          models: [
            {
              provider: "openai",
              id: "gpt-5",
              name: "GPT-5",
              reasoning: true,
              input: ["text", "image"],
              thinkingLevelMap: {
                off: "none",
                medium: "medium",
                xhigh: null,
              },
            },
          ],
        },
      }),
    ).toEqual([
      {
        provider: "openai",
        id: "gpt-5",
        name: "GPT-5",
        reasoning: true,
        input: ["text", "image"],
        thinkingLevelMap: {
          off: "none",
          medium: "medium",
          xhigh: null,
        },
      },
    ]);
  });

  it("filters invalid model entries and ignores empty input arrays", () => {
    expect(
      extractAvailableModels({
        models: [
          { provider: "openai", id: "gpt-5", input: [] },
          { provider: "openai" },
          { id: "missing-provider" },
          "invalid",
        ],
      }),
    ).toEqual([
      {
        contextWindow: undefined,
        provider: "openai",
        id: "gpt-5",
        name: undefined,
        reasoning: false,
        input: undefined,
        thinkingLevelMap: undefined,
      },
    ]);
  });
});
