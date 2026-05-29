// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createCommandUiController } from "../../../src/view/webview/features/command/ui.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

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

    const buttons = harness.panel.querySelectorAll<HTMLButtonElement>(".command-ui-item");
    buttons[1]?.click();
    expect(harness.postResponse).toHaveBeenCalledWith("req-1", { selectedId: "item-2" });
  });

  it("applies and clears result state", async () => {
    const harness = createHarness();
    const controller = createCommandUiController(harness.options);

    await controller.applyResult({ status: "success", message: "Done" });
    expect(harness.result.dataset.status).toBe("success");
    expect(harness.result.hidden).toBe(false);

    controller.clearResult();
    expect(harness.result.dataset.status).toBeUndefined();
    expect(harness.result.hidden).toBe(true);
  });

  it("hides panel and clears list entries when request is resolved", () => {
    const harness = createHarness();
    const controller = createCommandUiController(harness.options);
    controller.renderRequest({
      id: "req-1",
      kind: "session_list",
      items: [{ id: "item-1", label: "Item 1" }],
    });
    expect(harness.panel.querySelectorAll(".command-ui-item")).toHaveLength(1);

    controller.handleKeydown(createKeydownEvent("Enter"));

    expect(harness.panel.querySelectorAll(".command-ui-panel")).toHaveLength(0);
    expect(harness.panel.querySelectorAll(".command-ui-item")).toHaveLength(0);
  });
});

function createHarness() {
  const panel = document.createElement("section");
  const result = document.createElement("div");
  result.hidden = true;
  document.body.append(panel, result);
  const postResponse = vi.fn();
  return {
    panel,
    postResponse,
    result,
    options: {
      result: createCommandResultPort(result),
      view: createPreactRenderPort(panel),
      focusComposer() {},
      postResponse,
      setComposerValue() {},
    },
  };
}

function createCommandResultPort(result: HTMLElement) {
  return {
    clear() {
      result.textContent = "";
      result.hidden = true;
      delete result.dataset.status;
    },
    show(next: { message?: string; status: "success" | "error" }) {
      result.textContent = next.message ?? "";
      result.dataset.status = next.status;
      result.hidden = !next.message;
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
