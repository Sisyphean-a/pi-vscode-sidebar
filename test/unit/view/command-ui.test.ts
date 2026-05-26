// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sidebar command ui", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("renders command_ui_request items and posts respond_command_ui on click", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "command_ui_request",
          data: {
            id: "cmd-ui-1",
            kind: "session_list",
            items: [{ id: "session-1", label: "会话 1" }],
          },
        },
      }),
    );

    const item = document.querySelector("[data-command-ui-item='session-1']") as HTMLButtonElement;
    item.click();

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; requestId?: string }).type === "respond_command_ui" &&
          (message as { type?: string; requestId?: string }).requestId === "cmd-ui-1",
      ),
    ).toBe(true);
  });

  it("restores composer text on command_result error", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "command_result",
          data: {
            status: "error",
            message: "命令失败",
            restoreInput: "/name",
          },
        },
      }),
    );

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const result = document.getElementById("command-result") as HTMLElement;
    expect(prompt.value).toBe("/name");
    expect(result.textContent).toContain("命令失败");
  });

  it("clears command_result when the composer input changes", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "command_result",
          data: {
            status: "error",
            message: "会话名称不能为空",
            restoreInput: "/name",
          },
        },
      }),
    );

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const result = document.getElementById("command-result") as HTMLElement;
    prompt.value = "/name 查询样式配置位置";
    prompt.dispatchEvent(new Event("input", { bubbles: true }));

    expect(result.textContent).toBe("");
    expect(result.classList.contains("hidden")).toBe(true);
  });

  it("supports keyboard selection for command_ui_request items", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "command_ui_request",
          data: {
            id: "cmd-ui-2",
            kind: "session_tree",
            items: [
              { id: "node-1", label: "节点 1", active: true },
              { id: "node-2", label: "节点 2" },
            ],
          },
        },
      }),
    );

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; requestId?: string }).type === "respond_command_ui" &&
          (message as { type?: string; requestId?: string }).requestId === "cmd-ui-2",
      ),
    ).toBe(true);
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { payload?: { selectedId?: string } }).payload?.selectedId === "node-2",
      ),
    ).toBe(true);
  });
});
