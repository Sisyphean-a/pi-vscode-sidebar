import { describe, expect, it } from "vitest";

import {
  buildControllerRpcQueryResultEvent,
  createControllerRpcFlowState,
  getDynamicSlashCommand,
  isUnsupportedGetMessagesError,
  needsDynamicSlashCommandRefresh,
  rememberDynamicSlashCommands,
} from "../../../src/host/controller-rpc-flow-support.ts";

describe("controller rpc flow support", () => {
  it("tracks when dynamic slash commands need refreshing", () => {
    const state = createControllerRpcFlowState();

    expect(needsDynamicSlashCommandRefresh(state, "cg-status")).toBe(true);
    expect(getDynamicSlashCommand(state, "cg-status")).toBeUndefined();

    rememberDynamicSlashCommands(state, [
      {
        name: "cg-status",
        source: "extension",
        sourceInfo: {
          path: "E:\\github\\pi\\.pi\\extensions\\codegraph.ts",
          source: "local",
          scope: "user",
          origin: "top-level",
        },
      },
    ]);

    expect(needsDynamicSlashCommandRefresh(state, "cg-status")).toBe(false);
    expect(needsDynamicSlashCommandRefresh(state, "missing")).toBe(true);
    expect(getDynamicSlashCommand(state, "cg-status")).toMatchObject({
      name: "cg-status",
      source: "extension",
    });
  });

  it("replaces cached slash commands on refresh", () => {
    const state = createControllerRpcFlowState();
    rememberDynamicSlashCommands(state, [
      {
        name: "old-command",
        source: "extension",
        sourceInfo: {
          path: "old.ts",
          source: "local",
          scope: "user",
          origin: "top-level",
        },
      },
    ]);

    rememberDynamicSlashCommands(state, [
      {
        name: "new-command",
        source: "extension",
        sourceInfo: {
          path: "new.ts",
          source: "local",
          scope: "user",
          origin: "top-level",
        },
      },
    ]);

    expect(getDynamicSlashCommand(state, "old-command")).toBeUndefined();
    expect(getDynamicSlashCommand(state, "new-command")).toMatchObject({
      name: "new-command",
    });
  });

  it("builds query result events and keeps replay error policy explicit", () => {
    expect(buildControllerRpcQueryResultEvent("get_messages", { ok: true }, "cid-1", true)).toEqual(
      {
        type: "event",
        data: {
          type: "query_result",
          command: "get_messages",
          data: { ok: true },
          correlationId: "cid-1",
          replace: true,
        },
      },
    );

    expect(isUnsupportedGetMessagesError("Unknown RPC command: get_messages")).toBe(true);
    expect(isUnsupportedGetMessagesError("unsupported command")).toBe(true);
    expect(isUnsupportedGetMessagesError("network failure")).toBe(false);
    expect(isUnsupportedGetMessagesError(undefined)).toBe(false);
  });
});
