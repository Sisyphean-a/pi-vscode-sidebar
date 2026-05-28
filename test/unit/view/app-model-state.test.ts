// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sidebar webview model state", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("keeps the current model value when streaming state omits rpc model details", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "query_result",
            command: "get_available_models",
            data: {
              models: [{ provider: "openai", id: "gpt-5.3-codex", name: "GPT-5.3-Codex" }],
            },
          },
        },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { model: { provider: "openai", id: "gpt-5.3-codex" } },
          },
        },
      }),
    );

    await waitForFlush();

    const modelTrigger = document.getElementById("model-picker-trigger") as HTMLButtonElement;
    expect(modelTrigger.dataset.value).toBe("openai/gpt-5.3-codex");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "streaming" },
          },
        },
      }),
    );

    await waitForFlush();

    expect(modelTrigger.dataset.value).toBe("openai/gpt-5.3-codex");
  });

  it("shows image attachment action only for models with image input support", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "query_result",
            command: "get_available_models",
            data: {
              models: [
                { provider: "openai", id: "gpt-5", input: ["text", "image"] },
                { provider: "openai", id: "gpt-4.1-mini", input: ["text"] },
              ],
            },
          },
        },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { model: { provider: "openai", id: "gpt-5" } },
          },
        },
      }),
    );

    await waitForFlush();

    const imageButton = document.getElementById(
      "image-attachment-button",
    ) as HTMLButtonElement | null;
    expect(imageButton?.disabled).toBe(false);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { model: { provider: "openai", id: "gpt-4.1-mini" } },
          },
        },
      }),
    );

    await waitForFlush();
    expect(imageButton?.disabled).toBe(true);
  });
});

async function waitForFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}
