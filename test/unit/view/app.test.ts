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

    const title = document.getElementById("title");
    const statusBadge = document.getElementById("status-badge");
    const systemMessage = document.getElementById("system-message");
    expect(title?.textContent).toBe("未连接Pi");

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

    expect(title?.textContent).toBe("已连接");
    expect(statusBadge).toBeNull();
    expect(systemMessage).toBeNull();
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

    const title = document.getElementById("title");

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

    expect(title?.textContent).toBe("已连接");
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

  it("does not create duplicate assistant bubbles when response id appears late", async () => {
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
            type: "message_start",
            message: {
              role: "assistant",
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
            type: "message_end",
            message: {
              role: "assistant",
              responseId: "resp-late-1",
              content: [{ type: "text", text: "最终回复" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const bubbles = document.querySelectorAll("#message-feed .chat-message.role-assistant");
    expect(bubbles.length).toBe(1);
    expect(bubbles[0]?.textContent).toContain("最终回复");
  });

  it("renders repeated read toolcall delta updates in one activity item", async () => {
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
    const activityItems = document.querySelectorAll(".chat-activity-group");
    const toolBubbles = document.querySelectorAll("#message-feed .chat-message.role-tool");
    expect(activityItems.length).toBe(1);
    expect(activityItems[0]?.textContent).toContain("读取");
    expect(toolBubbles.length).toBe(0);
  });

  it("keeps pending thinking level selection when stale state arrives", async () => {
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
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { thinkingLevel: "high" },
          },
        },
      }),
    );

    const thinkingSelect = document.getElementById("thinking-level-select") as HTMLSelectElement;
    thinkingSelect.value = "xhigh";
    thinkingSelect.dispatchEvent(new Event("change"));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { thinkingLevel: "high" },
          },
        },
      }),
    );

    await waitForFlush();
    expect(thinkingSelect.value).toBe("xhigh");
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; level?: string }).type === "set_thinking_level" &&
          (message as { type?: string; level?: string }).level === "xhigh",
      ),
    ).toBe(true);
  });

  it("renders model and thinking controls as native selects", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const composerMeta = document.getElementById("composer-meta");
    const modelSelect = document.getElementById("model-select") as HTMLSelectElement | null;
    const thinkingSelect = document.getElementById(
      "thinking-level-select",
    ) as HTMLSelectElement | null;

    expect(composerMeta?.querySelectorAll("select").length).toBe(2);
    expect(modelSelect?.classList.contains("composer-select")).toBe(true);
    expect(thinkingSelect?.classList.contains("composer-select")).toBe(true);
    expect(document.getElementById("model-select-button")).toBeNull();
    expect(document.getElementById("thinking-level-button")).toBeNull();
  });

  it("renders recent session preview, opens the full dialog, and switches sessions on click", async () => {
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
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { sessionFile: "C:\\sessions\\session-2.jsonl" },
            recentSessions: [
              {
                sessionId: "session-1",
                sessionPath: "C:\\sessions\\session-1.jsonl",
                title: "给底部选择器加动画",
                updatedAt: "2026-05-26T02:59:00.000Z",
              },
              {
                sessionId: "session-2",
                sessionPath: "C:\\sessions\\session-2.jsonl",
                title: "优化侧边栏消息与工具展示",
                updatedAt: "2026-05-26T02:52:00.000Z",
              },
              {
                sessionId: "session-3",
                sessionPath: "C:\\sessions\\session-3.jsonl",
                title: "当前项目，是否有很多无意义的测试？",
                updatedAt: "2026-05-26T02:03:00.000Z",
              },
              {
                sessionId: "session-4",
                sessionPath: "C:\\sessions\\session-4.jsonl",
                title: "帮我按照这个规范，重构现有的两个页面",
                updatedAt: "2026-05-25T18:03:00.000Z",
              },
            ],
          },
        },
      }),
    );

    await waitForFlush();

    const previewItems = document.querySelectorAll("#recent-sessions-preview .recent-session-item");
    const moreButton = document.getElementById(
      "recent-sessions-more-button",
    ) as HTMLButtonElement | null;
    expect(previewItems).toHaveLength(3);
    expect(previewItems[1]?.classList.contains("is-active")).toBe(true);
    expect(moreButton?.textContent).toContain("查看全部（4 个）");

    moreButton?.click();
    await waitForFlush();

    const dialog = document.getElementById("recent-sessions-overlay");
    const dialogItems = document.querySelectorAll(
      "#recent-sessions-dialog-list .recent-session-item",
    );
    expect(dialog?.classList.contains("hidden")).toBe(false);
    expect(dialogItems).toHaveLength(4);

    (dialogItems[3] as HTMLButtonElement | undefined)?.click();
    await waitForFlush();

    expect(dialog?.classList.contains("hidden")).toBe(true);
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; sessionPath?: string }).type === "switch_session" &&
          (message as { type?: string; sessionPath?: string }).sessionPath ===
            "C:\\sessions\\session-4.jsonl",
      ),
    ).toBe(true);
  });

  it("uses a compact codex-like recent task layout without a redundant section label", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: {},
            recentSessions: [
              {
                sessionId: "session-1",
                sessionPath: "C:\\sessions\\session-1.jsonl",
                title: "统一 SVG 图标导出",
                updatedAt: "2026-05-26T02:59:00.000Z",
              },
            ],
          },
        },
      }),
    );

    await waitForFlush();

    const section = document.getElementById("recent-sessions-section");
    const moreButton = document.getElementById("recent-sessions-more-button");

    expect(section?.classList.contains("recent-sessions-stream")).toBe(true);
    expect(document.querySelector(".recent-sessions-label")).toBeNull();
    expect(moreButton?.classList.contains("recent-sessions-link")).toBe(true);
  });

  it("shows a clamp notice when backend keeps a different thinking level", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { thinkingLevel: "high" },
          },
        },
      }),
    );

    const thinkingSelect = document.getElementById("thinking-level-select") as HTMLSelectElement;
    thinkingSelect.value = "xhigh";
    thinkingSelect.dispatchEvent(new Event("change"));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "idle" },
            rpc: { thinkingLevel: "high" },
          },
        },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "query_result",
            command: "set_thinking_level",
            data: { ok: true },
          },
        },
      }),
    );

    await waitForFlush();
    expect(thinkingSelect.value).toBe("high");
    expect(document.querySelector("#message-feed")?.textContent).toContain("当前模型暂不支持超高");
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

  it("does not render duplicated connection helper copy under the topbar", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const emptyState = document.getElementById("empty-state");
    const systemMessage = document.getElementById("system-message");

    expect(emptyState).toBeNull();
    expect(systemMessage).toBeNull();
  });

  it("auto-resizes the composer and resets height after sending", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const send = document.getElementById("send-button") as HTMLButtonElement;
    let scrollHeight = 180;

    Object.defineProperty(prompt, "scrollHeight", {
      configurable: true,
      get() {
        return scrollHeight;
      },
    });

    prompt.value = "第一行\n第二行\n第三行";
    prompt.dispatchEvent(new Event("input"));

    expect(prompt.style.height).toBe("160px");

    scrollHeight = 72;
    send.click();
    await waitForFlush();

    expect(prompt.value).toBe("");
    expect(prompt.style.height).toBe("26px");
  });

  it("keeps multiline editing available with Shift+Enter", async () => {
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
    prompt.value = "第一行";
    prompt.selectionStart = prompt.value.length;
    prompt.selectionEnd = prompt.value.length;

    prompt.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    prompt.setRangeText("\n", prompt.selectionStart ?? 0, prompt.selectionEnd ?? 0, "end");
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
    await waitForFlush();

    expect(prompt.value).toBe("第一行\n");
    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "send_prompt",
      ),
    ).toBe(false);
  });

  it("switches send button to stop while streaming and emits abort", async () => {
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
          type: "state",
          data: {
            view: { phase: "streaming" },
            rpc: {},
          },
        },
      }),
    );

    const send = document.getElementById("send-button") as HTMLButtonElement;
    expect(send.textContent).toContain("停止");

    send.click();
    await waitForFlush();

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string }).type === "abort",
      ),
    ).toBe(true);
  });

  it("shows scroll-to-bottom button after user scrolls away during streaming", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const messageFeed = document.getElementById("message-feed") as HTMLDivElement;
    Object.defineProperty(messageFeed, "scrollHeight", {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(messageFeed, "clientHeight", {
      configurable: true,
      get() {
        return 400;
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "state",
          data: {
            view: { phase: "streaming" },
            rpc: {},
          },
        },
      }),
    );

    for (let index = 0; index < 3; index += 1) {
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
                  responseId: "resp-scroll-1",
                  content: [{ type: "text", text: `第 ${index} 段输出` }],
                },
              },
              message: {
                role: "assistant",
                responseId: "resp-scroll-1",
                content: [{ type: "text", text: `第 ${index} 段输出` }],
              },
            },
          },
        }),
      );
    }

    messageFeed.scrollTop = 200;
    messageFeed.dispatchEvent(new Event("scroll"));

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
                responseId: "resp-scroll-1",
                content: [{ type: "text", text: "第 4 段输出" }],
              },
            },
            message: {
              role: "assistant",
              responseId: "resp-scroll-1",
              content: [{ type: "text", text: "第 4 段输出" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const scrollButton = document.getElementById("scroll-to-bottom-button");
    expect(scrollButton?.classList.contains("hidden")).toBe(false);
    expect(messageFeed.scrollTop).toBe(200);
  });

  it("does not render role labels or local mode text", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    expect(document.querySelectorAll(".chat-role").length).toBe(0);
    expect(document.body.textContent).not.toContain("本地模式");
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

  it("renders assistant markdown with compact code block, copy action, and bold text", async () => {
    const clipboardWrites: string[] = [];
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          clipboardWrites.push(text);
          return Promise.resolve();
        },
      },
    });

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
              role: "assistant",
              responseId: "resp-md-1",
              content: [
                {
                  type: "text",
                  text: "# 标题\n\n这里有 `inline` 和 **重点**。\n\n```ts\nconst value = 1;\n```",
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();

    const assistantBubble = document.querySelector(
      "#message-feed .chat-message.role-assistant",
    ) as HTMLElement | null;
    const heading = assistantBubble?.querySelector("h1");
    const inlineCode = assistantBubble?.querySelector("code");
    const bold = assistantBubble?.querySelector("strong");
    const codeBlock = assistantBubble?.querySelector("pre code");
    const codeToolbar = assistantBubble?.querySelector(".code-block-toolbar");
    const languageLabel = assistantBubble?.querySelector(".code-block-language");
    const copyButton = assistantBubble?.querySelector(
      ".code-copy-button",
    ) as HTMLButtonElement | null;

    expect(heading?.textContent).toBe("标题");
    expect(inlineCode?.textContent).toContain("inline");
    expect(bold?.textContent).toBe("重点");
    expect(codeBlock?.textContent).toContain("const value = 1;");
    expect(codeToolbar).not.toBeNull();
    expect(languageLabel).toBeNull();
    expect(copyButton?.textContent).toContain("复制");

    copyButton?.click();
    await waitForFlush();

    expect(clipboardWrites).toContain("const value = 1;");
  });

  it("mounts assistant markdown in a block container instead of a paragraph", async () => {
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
              role: "assistant",
              responseId: "resp-md-structure-1",
              content: [
                {
                  type: "text",
                  text: "段落一\n\n### 小标题\n\n- 列表项",
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();

    const assistantBubble = document.querySelector(
      "#message-feed .chat-message.role-assistant .chat-content",
    ) as HTMLElement | null;

    expect(assistantBubble?.tagName).toBe("DIV");
  });

  it("renders markdown separators, headings and list items", async () => {
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
              role: "assistant",
              responseId: "resp-md-2",
              content: [
                {
                  type: "text",
                  text: "---\n\n### 1) Home 页面层级（组件树）\n\n- 路由\n  - `views/home/index.vue`",
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();

    const assistantBubble = document.querySelector(
      "#message-feed .chat-message.role-assistant",
    ) as HTMLElement | null;

    expect(assistantBubble?.querySelector("hr")).not.toBeNull();
    expect(assistantBubble?.querySelector("h3")?.textContent).toContain("Home 页面层级");
    expect(assistantBubble?.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    expect(assistantBubble?.textContent).toContain("views/home/index.vue");
  });

  it("renders file reference tokens as clickable chips and posts open request", async () => {
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
          type: "event",
          data: {
            type: "message_end",
            message: {
              role: "assistant",
              responseId: "resp-ref-1",
              content: [
                {
                  type: "text",
                  text: "@src/pi/env.ts:11-23",
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();

    const refButton = document.querySelector(".file-reference-chip") as HTMLButtonElement | null;
    const refBadge = refButton?.querySelector(".file-reference-badge");
    const refName = refButton?.querySelector(".file-reference-name");
    const refMeta = refButton?.querySelector(".file-reference-meta");
    expect(refBadge?.textContent).toBe("TS");
    expect(refName?.textContent).toBe("env.ts:11-23");
    expect(refMeta).toBeNull();

    refButton?.click();
    await waitForFlush();

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; path?: string; startLine?: number; endLine?: number })
            .type === "open_file_reference" &&
          (message as { path?: string }).path === "src/pi/env.ts" &&
          (message as { startLine?: number }).startLine === 11 &&
          (message as { endLine?: number }).endLine === 23,
      ),
    ).toBe(true);
  });

  it("inserts prompt reference tokens into the composer, sends them raw, and renders clickable chips in user messages", async () => {
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
    prompt.value = "请分析这段代码：";
    prompt.selectionStart = prompt.value.length;
    prompt.selectionEnd = prompt.value.length;
    (document.getElementById("send-button") as HTMLButtonElement).focus();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "insert_prompt_reference",
          data: {
            reference: "@src/pi/env.ts:11-23",
            path: "src/pi/env.ts",
            startLine: 11,
            endLine: 23,
            content: "export const PI = 3.14;\n",
            language: "typescript",
          },
        },
      }),
    );

    await waitForFlush();
    expect(prompt.value).toBe("请分析这段代码： @src/pi/env.ts:11-23 ");
    expect(document.activeElement).toBe(prompt);

    (document.getElementById("send-button") as HTMLButtonElement).click();
    await waitForFlush();

    const sendPromptMessage = postedMessages.find(
      (message) =>
        typeof message === "object" &&
        !!message &&
        (message as { type?: string }).type === "send_prompt",
    ) as { text?: string } | undefined;

    expect(sendPromptMessage?.text).toBe("请分析这段代码： @src/pi/env.ts:11-23");

    const userReferenceChip = document.querySelector(
      "#message-feed .chat-message.role-user .file-reference-chip",
    ) as HTMLButtonElement | null;
    expect(userReferenceChip?.textContent).toContain("env.ts");
    expect(userReferenceChip?.textContent).toContain("env.ts:11-23");

    userReferenceChip?.click();
    await waitForFlush();

    expect(
      postedMessages.some(
        (message) =>
          typeof message === "object" &&
          !!message &&
          (message as { type?: string; path?: string; startLine?: number; endLine?: number })
            .type === "open_file_reference" &&
          (message as { path?: string }).path === "src/pi/env.ts" &&
          (message as { startLine?: number }).startLine === 11 &&
          (message as { endLine?: number }).endLine === 23,
      ),
    ).toBe(true);
  });

  it("inserts prompt reference tokens with surrounding spaces and moves focus to the composer", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const prompt = document.getElementById("prompt-input") as HTMLTextAreaElement;
    const sendButton = document.getElementById("send-button") as HTMLButtonElement;
    prompt.value = "beforeafter";
    prompt.selectionStart = 6;
    prompt.selectionEnd = 6;
    sendButton.focus();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "insert_prompt_reference",
          data: {
            reference: "@src/pi/env.ts:11-23",
            path: "src/pi/env.ts",
            startLine: 11,
            endLine: 23,
            content: "export const PI = 3.14;\n",
            language: "typescript",
          },
        },
      }),
    );

    await waitForFlush();

    expect(prompt.value).toBe("before @src/pi/env.ts:11-23 after");
    expect(document.activeElement).toBe(prompt);
  });

  it("replays completed thinking from get_messages query results", async () => {
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
                  role: "assistant",
                  responseId: "resp-history-thinking-1",
                  content: [
                    { type: "thinking", thinking: "先梳理项目结构，再确认入口与协议层。" },
                    { type: "text", text: "这是一个 VS Code 侧边栏扩展。" },
                  ],
                },
              ],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const activityGroup = document.querySelector(
      ".chat-activity-group",
    ) as HTMLDetailsElement | null;
    const assistantBubble = document.querySelector(
      "#message-feed .chat-message.role-assistant",
    ) as HTMLElement | null;
    expect(activityGroup).not.toBeNull();
    expect(activityGroup?.open).toBe(false);
    expect(activityGroup?.textContent).toContain("已完成思考");
    expect(activityGroup?.textContent).toContain("思考：先梳理项目结构，再确认入口与协议层。");
    expect(assistantBubble?.textContent).toContain("这是一个 VS Code 侧边栏扩展。");
  });

  it("shows long tool output inside activity details", async () => {
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
      ".chat-activity-item-detail-pre",
    ) as HTMLPreElement | null;
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain("line-9");
  });

  it("renders thinking updates inline as soon as they stream in", async () => {
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
              type: "thinking_delta",
              delta: "先检查事件流和 DOM 更新。",
              partial: {
                role: "assistant",
                responseId: "resp-thinking-1",
                content: [{ type: "thinking", thinking: "" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const activityGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(activityGroup).not.toBeNull();
    expect(activityGroup?.textContent).toContain("思考");
    expect(activityGroup?.textContent).toContain("先检查事件流和 DOM 更新。");
    expect(activityGroup?.getAttribute("data-collapsed")).toBe("false");
  });

  it("does not render raw rpc transport chatter inline", async () => {
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
            type: "rpc_command_sent",
            id: "rpc-1",
            command: "prompt",
          },
        },
      }),
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "rpc_response",
            id: "rpc-1",
            command: "prompt",
            success: true,
          },
        },
      }),
    );

    await waitForFlush();
    const transcriptText = document.querySelector("#message-feed")?.textContent ?? "";
    expect(transcriptText).not.toContain("扩展调用 Pi：prompt");
    expect(transcriptText).not.toContain("Pi 已响应：prompt");
  });

  it("collapses tool steps immediately after the last tool result arrives", async () => {
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
              type: "toolcall_delta",
              partial: {
                role: "assistant",
                responseId: "resp-inline-1",
                content: [
                  {
                    type: "toolCall",
                    id: "call-inline-1",
                    name: "exec_command",
                    partialArgs: '{"cmd":"git status"}',
                  },
                ],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const runningGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(runningGroup).not.toBeNull();
    expect(runningGroup?.textContent).toContain("git status");
    expect(runningGroup?.getAttribute("data-collapsed")).toBe("false");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "message_end",
            message: {
              role: "toolResult",
              toolName: "exec_command",
              toolCallId: "call-inline-1",
              content: [{ type: "text", text: "On branch main" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const collapsedGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(collapsedGroup?.textContent).toContain("执行了：bash");
    expect(collapsedGroup?.textContent).toContain("bash：git status");
    expect(collapsedGroup?.getAttribute("data-collapsed")).toBe("true");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "message_end",
            message: {
              role: "assistant",
              responseId: "resp-inline-1",
              content: [{ type: "text", text: "整理好了。" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const summaryAfterAssistant = document.querySelector(
      ".chat-activity-group",
    ) as HTMLElement | null;
    expect(summaryAfterAssistant?.textContent).toContain("执行了：bash");
    expect(summaryAfterAssistant?.getAttribute("data-collapsed")).toBe("true");
  });

  it("keeps thinking visible instead of collapsing it into tool summaries", async () => {
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
              type: "thinking_delta",
              delta: "我先确认仓库结构和入口文件。",
              partial: {
                role: "assistant",
                responseId: "resp-thinking-visible-1",
                content: [{ type: "thinking", thinking: "" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const groups = Array.from(document.querySelectorAll(".chat-activity-group"));
    expect(
      groups.some((group) => group.textContent?.includes("思考：我先确认仓库结构和入口文件。")),
    ).toBe(true);
  });

  it("expands thinking while streaming and collapses it after thinking ends", async () => {
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
              type: "thinking_delta",
              delta: "先梳理这个活动流的展开规则。",
              partial: {
                role: "assistant",
                responseId: "resp-thinking-collapse-1",
                content: [{ type: "thinking", thinking: "" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const runningGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(runningGroup?.textContent).toContain("思考：先梳理这个活动流的展开规则。");
    expect(runningGroup?.getAttribute("data-collapsed")).toBe("false");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "event",
          data: {
            type: "message_update",
            assistantMessageEvent: {
              type: "thinking_end",
              delta: "先梳理这个活动流的展开规则。",
              partial: {
                role: "assistant",
                responseId: "resp-thinking-collapse-1",
                content: [{ type: "thinking", thinking: "" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const collapsedGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(collapsedGroup?.textContent).toContain("已完成思考");
    expect(collapsedGroup?.getAttribute("data-collapsed")).toBe("true");
  });

  it("collapses thinking as soon as assistant text starts even without thinking_end", async () => {
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
              type: "thinking_delta",
              delta: "先确认思考块什么时候应该收起。",
              partial: {
                role: "assistant",
                responseId: "resp-thinking-autoclose-1",
                content: [{ type: "thinking", thinking: "" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const runningGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(runningGroup?.textContent).toContain("思考：先确认思考块什么时候应该收起。");
    expect(runningGroup?.getAttribute("data-collapsed")).toBe("false");

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
                responseId: "resp-thinking-autoclose-1",
                content: [{ type: "text", text: "按你的要求改。" }],
              },
            },
          },
        },
      }),
    );

    await waitForFlush();
    const collapsedGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(collapsedGroup?.textContent).toContain("已完成思考");
    expect(collapsedGroup?.getAttribute("data-collapsed")).toBe("true");
  });

  it("renders command activity with collapsed detail by default after completion", async () => {
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
              type: "toolcall_delta",
              partial: {
                role: "assistant",
                responseId: "resp-command-1",
                content: [
                  {
                    type: "toolCall",
                    id: "call-command-1",
                    name: "exec_command",
                    partialArgs: '{"command":"bash","workdir":"/e/github/pi-vscode-sidebar"}',
                  },
                ],
              },
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
            type: "message_end",
            message: {
              role: "toolResult",
              toolName: "exec_command",
              toolCallId: "call-command-1",
              content: [{ type: "text", text: "/e/github/pi-vscode-sidebar\n---\nCHANGELOG.md" }],
            },
          },
        },
      }),
    );

    await waitForFlush();
    const activityGroup = document.querySelector(
      ".chat-activity-group",
    ) as HTMLDetailsElement | null;
    const itemDetail = document.querySelector(
      ".chat-activity-item-detail",
    ) as HTMLDetailsElement | null;
    expect(activityGroup?.open).toBe(false);
    expect(activityGroup?.textContent).toContain("执行了：bash");
    expect(activityGroup?.textContent).toContain("bash：/e/github/pi-vscode-sidebar");
    expect(itemDetail?.open).toBe(false);
    expect(itemDetail?.textContent).toContain("CHANGELOG.md");
  });

  it("summarizes collapsed tool groups with concrete tool names", async () => {
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });

    await import("../../../src/view/webview/app.ts");

    const dispatchTool = (id: string, name: string, partialArgs: string) => {
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
                  responseId: "resp-summary-1",
                  content: [{ type: "toolCall", id, name, partialArgs }],
                },
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
              type: "message_end",
              message: {
                role: "toolResult",
                toolName: name,
                toolCallId: id,
                content: [{ type: "text", text: "ok" }],
              },
            },
          },
        }),
      );
    };

    dispatchTool("call-read", "read", '{"path":"README.md"}');
    dispatchTool(
      "call-bash",
      "exec_command",
      '{"command":"bash","workdir":"/e/github/pi-vscode-sidebar"}',
    );
    dispatchTool("call-codegraph", "codegraph_files", '{"path":"src"}');

    await waitForFlush();
    const activityGroup = document.querySelector(".chat-activity-group") as HTMLElement | null;
    expect(activityGroup?.textContent).toContain("执行了：读取、bash、codegraph_files");
  });

  it("filters thinking level options from model thinkingLevelMap", async () => {
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
                {
                  provider: "hi-code",
                  id: "gpt-5.4",
                  reasoning: true,
                  thinkingLevelMap: {
                    off: null,
                    minimal: null,
                    xhigh: "xhigh",
                  },
                },
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
            rpc: {
              model: { provider: "hi-code", id: "gpt-5.4" },
              thinkingLevel: "high",
            },
          },
        },
      }),
    );

    await waitForFlush();

    const thinkingSelect = document.getElementById("thinking-level-select") as HTMLSelectElement;
    expect(Array.from(thinkingSelect.options).map((option) => option.value)).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });

  it("loads available models into the selector and sends set_model on change", async () => {
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
          type: "event",
          data: {
            type: "query_result",
            command: "get_available_models",
            data: {
              models: [
                { provider: "openai", id: "gpt-5" },
                { provider: "anthropic", id: "claude-opus-4" },
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

    const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
    expect(Array.from(modelSelect.options).map((option) => option.value)).toContain("openai/gpt-5");
    modelSelect.value = "anthropic/claude-opus-4";
    modelSelect.dispatchEvent(new Event("change"));

    const setModelMessage = postedMessages.find(
      (message) =>
        typeof message === "object" &&
        !!message &&
        (message as { type?: string }).type === "set_model",
    ) as { provider?: string; modelId?: string } | undefined;

    expect(setModelMessage).toMatchObject({
      provider: "anthropic",
      modelId: "claude-opus-4",
    });
  });
});

async function waitForFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}
