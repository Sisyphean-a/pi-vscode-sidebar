// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sidebar command palette", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("opens the palette when the composer starts with slash", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    prompt.value = "/";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));

    const panel = document.getElementById("command-palette-panel");
    expect(panel?.classList.contains("hidden")).toBe(false);
  });

  it("submits run_command instead of send_prompt for slash commands", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    prompt.value = "/compact";
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; name?: string; rawInput?: string }).type === "run_command" &&
          (message as { type?: string; name?: string; rawInput?: string }).name === "compact" &&
          (message as { type?: string; name?: string; rawInput?: string }).rawInput === "/compact",
      ),
    ).toBe(true);
  });

  it("completes the selected command before submitting partial slash input", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    prompt.value = "/co";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    expect(prompt.value).toBe("/compact");
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "run_command",
      ),
    ).toBe(false);

    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; name?: string }).type === "run_command" &&
          (message as { type?: string; name?: string }).name === "compact",
      ),
    ).toBe(true);
  });

  it("renders built-in and dynamic command descriptions with source badges", async () => {
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
            command: "get_commands",
            data: {
              commands: [
                {
                  name: "cg-status",
                  description: "Show CodeGraph status",
                  source: "extension",
                  sourceInfo: {
                    path: "E:\\github\\pi\\.pi\\extensions\\codegraph.ts",
                    source: "local",
                    scope: "user",
                    origin: "top-level",
                  },
                },
              ],
            },
          },
        },
      }),
    );

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    prompt.value = "/ne";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));

    const builtinListText = document.getElementById("command-palette-list")?.textContent ?? "";
    expect(builtinListText).toContain("Start a new session");

    prompt.value = "/cg";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));

    const dynamicListText = document.getElementById("command-palette-list")?.textContent ?? "";
    expect(dynamicListText).toContain("cg-status");
    expect(dynamicListText).toContain("[u]");
    expect(dynamicListText).toContain("Show CodeGraph status");
  });
});
