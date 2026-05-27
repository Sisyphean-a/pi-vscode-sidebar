// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";
import {
  attachConversationMessageImages,
  ensureConversationMessageRefs,
  renderConversationMessageText,
} from "../../../src/view/webview/conversation-feed-dom.ts";

describe("conversation feed dom", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="feed-root"></div>`;
  });

  it("collapses long tool output into details and removes tool details after role switches", () => {
    const container = document.getElementById("feed-root");
    if (!container) throw new Error("Missing feed container.");

    const messagesByKey = new Map();
    const toolState = ensureConversationMessageRefs(messagesByKey, container, "msg-1", "tool");
    renderConversationMessageText(
      {
        renderAssistantMarkdown: (text) => {
          const fragment = document.createDocumentFragment();
          const strong = document.createElement("strong");
          strong.textContent = text;
          fragment.append(strong);
          return fragment;
        },
        renderPlainTextWithReferences: (text) => {
          const fragment = document.createDocumentFragment();
          fragment.append(text);
          return fragment;
        },
      },
      toolState,
      "line-1\nline-2\nline-3\nline-4\nline-5",
    );

    expect(container.querySelector(".chat-tool-details")).not.toBeNull();
    expect(container.textContent).toContain("line-1");

    const assistantState = ensureConversationMessageRefs(
      messagesByKey,
      container,
      "msg-1",
      "assistant",
    );
    renderConversationMessageText(
      {
        renderAssistantMarkdown: (text) => {
          const fragment = document.createDocumentFragment();
          const strong = document.createElement("strong");
          strong.textContent = text;
          fragment.append(strong);
          return fragment;
        },
        renderPlainTextWithReferences: (text) => {
          const fragment = document.createDocumentFragment();
          fragment.append(text);
          return fragment;
        },
      },
      assistantState,
      "assistant answer",
    );

    expect(container.querySelector(".chat-tool-details")).toBeNull();
    expect(assistantState.article.className).toBe("chat-message role-assistant");
    expect(container.querySelector("strong")?.textContent).toBe("assistant answer");
  });

  it("replaces existing user attachment strip when new attachments arrive", () => {
    const container = document.getElementById("feed-root");
    if (!container) throw new Error("Missing feed container.");

    const messagesByKey = new Map();
    const userState = ensureConversationMessageRefs(messagesByKey, container, "msg-2", "user");
    attachConversationMessageImages(userState, [createAttachment("a.png")]);
    attachConversationMessageImages(userState, [
      createAttachment("b.png"),
      createAttachment("c.png"),
    ]);

    const images = Array.from(
      container.querySelectorAll(".message-image-attachment"),
    ) as HTMLImageElement[];
    expect(images).toHaveLength(2);
    expect(images.map((image) => image.alt)).toEqual(["b.png", "c.png"]);
  });
});

function createAttachment(name: string): UiPendingImageAttachment {
  return {
    id: name,
    name,
    previewUrl: `blob:${name}`,
    image: { data: "AAAA", mimeType: "image/png", type: "image" },
  };
}
