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

  it("updates one assistant bubble during text streaming", async () => {
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
    const bubbles = document.querySelectorAll("#message-feed .chat-message.role-assistant");
    expect(bubbles.length).toBe(1);
    expect(bubbles[0]?.textContent).toContain("Hi! What can I help you with?");
  });

  it("collapses repeated read toolcall delta updates into one tool bubble", async () => {
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
    const toolBubbles = document.querySelectorAll("#message-feed .chat-message.role-tool");
    expect(toolBubbles.length).toBe(1);
    expect(toolBubbles[0]?.textContent).toContain("read");
  });

  it("renders user prompt as a normal user message bubble", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const send = document.getElementById("send-button") as HTMLButtonElement;
    prompt.value = "帮我看下这个函数";
    send.click();

    await waitForFlush();
    const userBubbles = document.querySelectorAll("#message-feed .chat-message.role-user");
    expect(userBubbles.length).toBe(1);
    expect(userBubbles[0]?.textContent).toContain("帮我看下这个函数");
  });

  it("replays conversation messages from get_messages query results", async () => {
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
            command: "get_messages",
            replace: true,
            data: {
              messages: [
                {
                  role: "user",
                  content: [{ type: "text", text: "你好，帮我定位 bug" }],
                },
                {
                  role: "assistant",
                  responseId: "resp-history-1",
                  content: [{ type: "text", text: "收到，我先看堆栈信息。" }],
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const userBubbles = document.querySelectorAll("#message-feed .chat-message.role-user");
    const assistantBubbles = document.querySelectorAll(
      "#message-feed .chat-message.role-assistant",
    );
    expect(userBubbles.length).toBe(1);
    expect(assistantBubbles.length).toBe(1);
    expect(userBubbles[0]?.textContent).toContain("你好，帮我定位 bug");
    expect(assistantBubbles[0]?.textContent).toContain("收到，我先看堆栈信息。");
  });

  it("collapses long tool output into expandable details", async () => {
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
            type: "message_end",
            message: {
              role: "toolResult",
              toolName: "read",
              toolCallId: "tool-call-1",
              content: [
                {
                  type: "text",
                  text: "line-1\nline-2\nline-3\nline-4\nline-5\nline-6\nline-7\nline-8\nline-9",
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const details = document.querySelector(
      "#message-feed .chat-message.role-tool details.chat-tool-details",
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("line-9");
  });
});

async function waitForFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}
