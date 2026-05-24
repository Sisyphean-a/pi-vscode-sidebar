import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error bridge injection script is plain JS and loaded at runtime by Pi.
import registerPiVsCodeBridge from "../../bridge/pi-vscode-bridge.js";

interface RegisteredTool {
  name: string;
  execute: (toolCallId?: string, params?: Record<string, unknown>) => Promise<unknown>;
}

describe("bridge tools integration", () => {
  beforeEach(() => {
    process.env.PI_VSCODE_BRIDGE_URL = "http://127.0.0.1:31000";
    process.env.PI_VSCODE_BRIDGE_TOKEN = "token-1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PI_VSCODE_BRIDGE_URL;
    delete process.env.PI_VSCODE_BRIDGE_TOKEN;
  });

  it("routes at least 5 read tools and 3 write tools through bridge rpc", async () => {
    const registered: RegisteredTool[] = [];
    const rpcCalls: Array<{ method: string; params: Record<string, unknown> }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = typeof init?.body === "string" ? init.body : "{}";
        rpcCalls.push(JSON.parse(body) as { method: string; params: Record<string, unknown> });
        return new Response(JSON.stringify({ result: { ok: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    registerPiVsCodeBridge({
      registerTool(tool: RegisteredTool) {
        registered.push(tool);
      },
    });

    await executeTool(registered, "vscode_get_editor_state");
    await executeTool(registered, "vscode_get_diagnostics", { filePath: "a.ts" });
    await executeTool(registered, "vscode_get_references", {
      filePath: "a.ts",
      position: { line: 0, character: 0 },
    });
    await executeTool(registered, "vscode_get_workspace_symbols", { query: "auth" });
    await executeTool(registered, "vscode_get_code_actions", { filePath: "a.ts" });

    await executeTool(registered, "vscode_open_file", { filePath: "a.ts" });
    await executeTool(registered, "vscode_save_document", { filePath: "a.ts" });
    await executeTool(registered, "vscode_apply_workspace_edit", { edits: [] });

    expect(rpcCalls.map((entry) => entry.method)).toEqual([
      "getEditorState",
      "getDiagnostics",
      "getReferences",
      "getWorkspaceSymbols",
      "getCodeActions",
      "openFile",
      "saveDocument",
      "applyWorkspaceEdit",
    ]);
  });
});

async function executeTool(
  tools: RegisteredTool[],
  name: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const tool = tools.find((item) => item.name === name);
  expect(tool, `tool not found: ${name}`).toBeTruthy();
  if (!tool) return;

  if (params) {
    await tool.execute("tool-call-id", params);
  } else {
    await tool.execute();
  }
}
