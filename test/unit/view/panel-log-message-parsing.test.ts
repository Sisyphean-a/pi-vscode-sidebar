import { describe, expect, it } from "vitest";

import {
  parsePanelLogLine,
  parsePanelLogUiMessage,
  parsePanelLogMessage,
} from "../../../src/view/webview/panel-log-message-parsing.ts";

describe("panel log message parsing", () => {
  it("accepts log_entry message with string line", () => {
    expect(parsePanelLogMessage({ type: "log_entry", line: '{"message":"ok"}' })).toEqual({
      type: "log_entry",
      line: '{"message":"ok"}',
    });
  });

  it("rejects malformed host payload", () => {
    expect(parsePanelLogMessage({ type: "log_entry", line: 1 })).toBeUndefined();
    expect(parsePanelLogMessage({ type: "notice", line: "ok" })).toBeUndefined();
  });

  it("accepts clear_panel_logs ui messages", () => {
    expect(parsePanelLogUiMessage({ type: "ui_ready" })).toEqual({ type: "ui_ready" });
    expect(parsePanelLogUiMessage({ type: "clear_panel_logs" })).toEqual({
      type: "clear_panel_logs",
    });
    expect(parsePanelLogUiMessage({ type: "clear_panel_logs", line: "x" })).toEqual({
      type: "clear_panel_logs",
    });
    expect(parsePanelLogUiMessage({ type: "unknown" })).toBeUndefined();
  });

  it("accepts only object json lines", () => {
    expect(parsePanelLogLine('{"level":"info","message":"ok"}')).toEqual({
      level: "info",
      message: "ok",
    });
    expect(parsePanelLogLine("[]")).toBeUndefined();
    expect(parsePanelLogLine("1")).toBeUndefined();
    expect(parsePanelLogLine("plain text")).toBeUndefined();
  });
});
