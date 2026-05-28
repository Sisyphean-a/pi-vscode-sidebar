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
  it("rejects empty token at startup", async () => {
    await expect(
      createBridgeHttpServer({
        token: "   ",
        handleRpc: async () => ({ ok: true }),
      }),
    ).rejects.toThrowError("Bridge token must not be empty.");
  });

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
    await expect(response.json()).resolves.toMatchObject({
      code: "BRIDGE_UNAUTHORIZED",
      message: "Unauthorized",
    });
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
      code: "BRIDGE_PAYLOAD_TOO_LARGE",
      message: "Request body exceeds limit",
    });
  });

  it("rejects non-object params payload", async () => {
    const bridge = await createBridgeHttpServer({
      token: "secret-token",
      handleRpc: async () => ({ ok: true }),
    });
    disposers.push(bridge.dispose);

    const response = await fetch(`${bridge.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": "secret-token",
      },
      body: JSON.stringify({ method: "getStatus", params: [] }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "BRIDGE_INVALID_PARAMS",
      message: "RPC params must be an object",
    });
  });

  it("returns unknown method error as client error", async () => {
    const bridge = await createBridgeHttpServer({
      token: "secret-token",
      handleRpc: async (method) => {
        throw new Error(`Unknown bridge method: ${method}`);
      },
    });
    disposers.push(bridge.dispose);

    const response = await fetch(`${bridge.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": "secret-token",
      },
      body: JSON.stringify({ method: "notImplemented", params: {} }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "BRIDGE_UNKNOWN_METHOD",
      message: "Unknown bridge method: notImplemented",
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
      code: "BRIDGE_RPC_TIMEOUT",
      message: "Bridge RPC request timed out after 1000ms",
    });
  });
});
