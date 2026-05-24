import { afterEach, describe, expect, it } from "vitest";
import { createBridgeHttpServer } from "../../../src/bridge/server.ts";

const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (disposers.length > 0) {
    const dispose = disposers.pop();
    if (dispose) await dispose();
  }
});

describe("createBridgeHttpServer", () => {
  it("rejects unauthorized requests", async () => {
    const bridge = await createBridgeHttpServer({
      token: "secret-token",
      handleRpc: async () => ({ ok: true }),
      maxRequestBytes: 1024,
    });
    disposers.push(bridge.dispose);

    const response = await fetch(`${bridge.url}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "getStatus", params: {} }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("rejects oversized payloads", async () => {
    const bridge = await createBridgeHttpServer({
      token: "secret-token",
      handleRpc: async () => ({ ok: true }),
      maxRequestBytes: 40,
    });
    disposers.push(bridge.dispose);

    const response = await fetch(`${bridge.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": "secret-token",
      },
      body: JSON.stringify({
        method: "getStatus",
        params: {
          giant: "x".repeat(500),
        },
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "Request body exceeds 40 bytes",
    });
  });

  it("returns timeout when bridge handler exceeds deadline", async () => {
    const bridge = await createBridgeHttpServer({
      token: "secret-token",
      rpcTimeoutMs: 1000,
      handleRpc: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return { ok: true };
      },
    });
    disposers.push(bridge.dispose);

    const response = await fetch(`${bridge.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": "secret-token",
      },
      body: JSON.stringify({ method: "getStatus", params: {} }),
    });

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: "Bridge RPC request timed out after 1000ms",
    });
  });
});
