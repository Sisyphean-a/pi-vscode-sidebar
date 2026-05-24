// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sidebar webview app", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("replaces booting notice after first state update", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/app.ts");

    const systemMessage = document.getElementById("system-message");
    expect(systemMessage?.textContent).toContain("侧边栏正在启动");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: {},
          },
        },
      }),
    );

    expect(systemMessage?.textContent).toContain("已连接");
    expect(systemMessage?.textContent).not.toContain("侧边栏正在启动");
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "ui_ready",
      ),
    ).toBe(true);
  });

  it("replaces booting notice after first event update", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const systemMessage = document.getElementById("system-message");
    expect(systemMessage?.textContent).toContain("侧边栏正在启动");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "agent_start",
          },
        },
      }),
    );

    expect(systemMessage?.textContent).toContain("已连接");
    expect(systemMessage?.textContent).not.toContain("侧边栏正在启动");
  });

  it("updates one assistant card during text streaming", async () => {
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
            type: "message_update",
            assistantMessageEvent: {
              type: "text_delta",
              partial: {
                role: "assistant",
                responseId: "resp-1",
                content: [{ type: "text", text: "Hi" }],
              },
            },
            message: {
              role: "assistant",
              responseId: "resp-1",
              content: [{ type: "text", text: "Hi" }],
            },
          },
        },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "message_update",
            assistantMessageEvent: {
              type: "text_delta",
              partial: {
                role: "assistant",
                responseId: "resp-1",
                content: [{ type: "text", text: "Hi! What can I help you with?" }],
              },
            },
            message: {
              role: "assistant",
              responseId: "resp-1",
              content: [{ type: "text", text: "Hi! What can I help you with?" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const cards = document.querySelectorAll("#event-feed .message-card");
    expect(cards.length).toBe(1);
    expect(cards[0]?.textContent).toContain("Hi! What can I help you with?");
  });

  it("collapses repeated read toolcall delta updates into one card", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "event",
            data: {
              type: "message_update",
              assistantMessageEvent: {
                type: "toolcall_delta",
                partial: {
                  role: "assistant",
                  responseId: "resp-2",
                  content: [
                    {
                      type: "toolCall",
                      id: `call-${index}`,
                      name: "read",
                      partialArgs: `{"path":"${index}"`,
                    },
                  ],
                },
              },
              message: {
                role: "assistant",
                responseId: "resp-2",
                content: [
                  {
                    type: "toolCall",
                    id: `call-${index}`,
                    name: "read",
                    partialArgs: `{"path":"${index}"`,
                  },
                ],
              },
            },
          },
        }),
      );
    }

    await waitForFlush();
    const cards = document.querySelectorAll("#event-feed .message-card");
    expect(cards.length).toBe(1);
    expect(cards[0]?.textContent).toContain("助手思考中（调用 read）");
  });
});

async function waitForFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}
