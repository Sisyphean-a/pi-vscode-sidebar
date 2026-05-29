// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { UiPendingImageAttachment } from "../../../src/view/protocol.ts";
import { createConversationFeed } from "../../../src/view/webview/features/conversation/feed.ts";
import { createPreactRenderPort } from "../../../src/view/webview/ui/preact-render-port.ts";

describe("conversation feed", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="feed-root"></div>`;
  });

  it("clears user attachments when the same message becomes collapsed tool output", () => {
    const container = document.getElementById("feed-root");
    if (!container) throw new Error("Missing feed container.");

    const feed = createConversationFeed({
      view: createPreactRenderPort(container),
      onChange() {},
      renderAssistantMarkdown(text) {
        return text;
      },
      renderPlainTextWithReferences(text) {
        return text;
      },
    });

    feed.setMessageText("msg-1", "user", "请看这张图", "replace");
    feed.attachImagesToMessage("msg-1", [createAttachment("a.png")]);
    feed.setMessageText("msg-1", "tool", "line-1\nline-2\nline-3\nline-4\nline-5", "replace");

    expect(container.querySelectorAll(".message-image-attachment")).toHaveLength(0);
    expect(container.querySelector(".chat-message")?.className).toBe("chat-message role-tool");
    expect(container.querySelector(".chat-tool-details")).not.toBeNull();
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
