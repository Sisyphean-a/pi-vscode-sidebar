import { describe, expect, it, vi } from "vitest";

import { createHostMessageHandler } from "../../../src/view/webview/host/message-handler.ts";

describe("webview host message handler", () => {
  it("surfaces rpc errors to model controls and conversation feed", () => {
    const deps = createHandlerDependencies();

    deps.handler.handle({
      type: "error",
      scope: "rpc",
      message: "boom",
    });

    expect(deps.modelControls.handleHostError).toHaveBeenCalledTimes(1);
    expect(deps.conversationPage.appendTransientMessage).toHaveBeenCalledWith("error", "boom");
  });

  it("throws on invalid host event payload", () => {
    const deps = createHandlerDependencies();

    expect(() => {
      deps.handler.handle({
        type: "event",
        data: "bad",
      });
    }).toThrowError("Invalid host event payload.");
  });

  it("throws on invalid host state payload", () => {
    const deps = createHandlerDependencies();

    expect(() => {
      deps.handler.handle({
        type: "state",
        data: "bad",
      });
    }).toThrowError("Invalid host state payload.");
  });

  it("routes query_result events to conversation only when model controls do not consume them", () => {
    const deps = createHandlerDependencies();
    deps.modelControls.handleQueryResult.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const queryResult = {
      type: "query_result",
      command: "set_model",
      ok: true,
    };

    deps.handler.handle({
      type: "event",
      data: queryResult,
    });
    deps.handler.handle({
      type: "event",
      data: queryResult,
    });

    expect(deps.modelControls.handleQueryResult).toHaveBeenCalledTimes(2);
    expect(deps.conversationPage.applyEvent).toHaveBeenCalledTimes(1);
    expect(deps.conversationPage.applyEvent).toHaveBeenCalledWith(queryResult);
  });
});

function createHandlerDependencies() {
  const commandPalette = {
    hide: vi.fn(),
  };
  const commandUi = {
    applyResult: vi.fn(async () => {}),
    renderRequest: vi.fn(),
  };
  const conversationPage = {
    appendTransientMessage: vi.fn(),
    applyEvent: vi.fn(() => false),
    applyState: vi.fn(),
    syncRecentSessionsVisibility: vi.fn(),
  };
  const imageAttachmentController = {
    applyAdded: vi.fn(),
  };
  const modelControls = {
    handleHostError: vi.fn(),
    handleQueryResult: vi.fn(() => false),
    requestAvailableModels: vi.fn(),
    syncRpcState: vi.fn(),
  };
  const promptReferenceEditor = {
    insert: vi.fn(),
  };
  const renderExtensionUiRequest = vi.fn();

  const handler = createHostMessageHandler({
    commandPalette: commandPalette as never,
    commandUi: commandUi as never,
    conversationPage: conversationPage as never,
    imageAttachmentController: imageAttachmentController as never,
    modelControls: modelControls as never,
    promptReferenceEditor: promptReferenceEditor as never,
    renderExtensionUiRequest,
  });

  return {
    conversationPage,
    handler,
    modelControls,
  };
}
