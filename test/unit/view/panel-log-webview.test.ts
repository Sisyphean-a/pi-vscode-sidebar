// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("panel log webview", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="log-app"></div>`;
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage() {},
    });
  });

  it("posts ui_ready on boot", async () => {
    const postedMessages: unknown[] = [];
    (
      globalThis as unknown as { acquireVsCodeApi: () => { postMessage(message: unknown): void } }
    ).acquireVsCodeApi = () => ({
      postMessage(message: unknown) {
        postedMessages.push(message);
      },
    });

    await import("../../../src/view/webview/panel-log-app.ts");

    expect(postedMessages).toContainEqual({ type: "ui_ready" });
  });

  it("renders parsed json log lines as collapsed rows with details", async () => {
    await import("../../../src/view/webview/panel-log-app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "log_entry",
          line: JSON.stringify({
            timestamp: "2026-05-27T14:00:00.000Z",
            level: "info",
            scope: "rpc",
            message: "rpc outbound",
            details: { command: "get_messages" },
          }),
        },
      }),
    );

    const row = document.querySelector(".panel-log-entry") as HTMLDetailsElement | null;
    expect(row).not.toBeNull();
    expect(row?.open).toBe(false);
    expect(row?.textContent).toContain("info");
    expect(row?.textContent).toContain("rpc");
    expect(row?.textContent).toContain("rpc outbound");
    expect(row?.querySelector("pre")?.textContent).toContain('"command": "get_messages"');
  });

  it("renders invalid json lines as raw text rows", async () => {
    await import("../../../src/view/webview/panel-log-app.ts");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "log_entry",
          line: "not-json",
        },
      }),
    );

    const row = document.querySelector(".panel-log-entry") as HTMLDetailsElement | null;
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("not-json");
  });
});
