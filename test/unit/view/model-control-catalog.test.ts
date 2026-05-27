import { describe, expect, it } from "vitest";
import {
  buildModelControlCatalog,
  resolveActiveCatalogModel,
} from "../../../src/view/webview/model-control-catalog.ts";

describe("model control catalog", () => {
  it("builds sorted model values and disambiguated labels from query results", () => {
    const catalog = buildModelControlCatalog({
      data: {
        models: [
          { provider: "openai", id: "gpt-5", name: "GPT-5" },
          { provider: "hi-code", id: "gpt-5", name: "GPT-5" },
          { provider: "anthropic", id: "claude-opus-4", name: "Claude-Opus-4" },
        ],
      },
    });

    expect(catalog?.availableModelValues).toEqual([
      "anthropic/claude-opus-4",
      "hi-code/gpt-5",
      "openai/gpt-5",
    ]);
    expect(catalog?.modelLabelByValue.get("openai/gpt-5")).toBe("openai 5");
    expect(catalog?.modelLabelByValue.get("hi-code/gpt-5")).toBe("hi-code 5");
    expect(catalog?.modelLabelByValue.get("anthropic/claude-opus-4")).toBe("Opus 4");
  });

  it("prefers the pending model value when resolving the active catalog model", () => {
    const catalog = buildModelControlCatalog({
      models: [
        { provider: "openai", id: "gpt-5" },
        { provider: "openai", id: "gpt-4.1-mini" },
      ],
    });
    if (!catalog) throw new Error("Missing model catalog.");

    const active = resolveActiveCatalogModel(
      catalog.availableModelsByValue,
      "openai/gpt-5",
      "openai/gpt-4.1-mini",
    );

    expect(active).toMatchObject({ provider: "openai", id: "gpt-4.1-mini" });
  });
});
