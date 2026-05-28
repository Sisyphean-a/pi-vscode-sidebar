// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createCommandUiController } from "../../../src/view/webview/command-ui.ts";

describe("command ui controller", () => {
  it("submits selected item payload", () => {
    const harness = createHarness();
    const controller = createCommandUiController(harness.options);

    controller.renderRequest({
      id: "req-1",
      kind: "model_list",
      items: [
        { id: "item-1", label: "Item 1", depth: 0 },
        { id: "item-2", label: "Item 2", depth: 2, active: true },
      ],
    });

    const buttons = harness.list.querySelectorAll<HTMLButtonElement>(".command-ui-item");
    buttons[1]?.click();
    expect(harness.postResponse).toHaveBeenCalledWith("req-1", { selectedId: "item-2" });
  });

  it("applies and clears result state", async () => {
    const harness = createHarness();
    const controller = createCommandUiController(harness.options);

    await controller.applyResult({ status: "success", message: "Done" });
    expect(harness.result.dataset.status).toBe("success");
    expect(harness.result.classList.contains("hidden")).toBe(false);

    controller.clearResult();
    expect(harness.result.dataset.status).toBeUndefined();
    expect(harness.result.classList.contains("hidden")).toBe(true);
  });

  it("hides panel and clears list entries when request is resolved", () => {
    const harness = createHarness();
    const controller = createCommandUiController(harness.options);
    controller.renderRequest({
      id: "req-1",
      kind: "session_list",
      items: [{ id: "item-1", label: "Item 1" }],
    });
    expect(harness.list.querySelectorAll(".command-ui-item")).toHaveLength(1);

    controller.handleKeydown(createKeydownEvent("Enter"));

    expect(harness.panel.classList.contains("hidden")).toBe(true);
    expect(harness.list.querySelectorAll(".command-ui-item")).toHaveLength(0);
  });
});

function createHarness() {
  const panel = document.createElement("section");
  const list = document.createElement("div");
  const result = document.createElement("div");
  result.className = "hidden";
  panel.append(list);
  document.body.append(panel, result);
  const postResponse = vi.fn();
  return {
    list,
    panel,
    postResponse,
    result,
    options: {
      panel,
      list,
      result,
      focusComposer() {},
      postResponse,
      setComposerValue() {},
    },
  };
}

function createKeydownEvent(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key });
  Object.defineProperty(event, "preventDefault", {
    value: vi.fn(),
    configurable: true,
  });
  return event;
}
