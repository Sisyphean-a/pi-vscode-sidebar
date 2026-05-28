import { describe, expect, it, vi } from "vitest";

import { createUiMessagePoster } from "../../../src/view/webview/host/ui-message-poster.ts";

describe("ui message poster", () => {
  it("posts ui_ready without correlationId", () => {
    const postMessage = vi.fn();
    const poster = createUiMessagePoster({ postMessage });

    poster.post({ type: "ui_ready" });

    expect(postMessage).toHaveBeenCalledWith({ type: "ui_ready" });
  });

  it("adds correlationId for non-ui_ready messages", () => {
    const postMessage = vi.fn();
    const poster = createUiMessagePoster({ postMessage });

    poster.post({ type: "run_command", name: "compact" });

    const payload = postMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.type).toBe("run_command");
    expect(payload.name).toBe("compact");
    expect(typeof payload.correlationId).toBe("string");
    expect((payload.correlationId as string).startsWith("ui-")).toBe(true);
  });
});
