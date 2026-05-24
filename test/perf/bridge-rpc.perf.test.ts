import { describe, expect, it } from "vitest";
import { createBridgeHttpServer } from "../../src/bridge/server.ts";
import { nowMs, percentile, readPerfThresholds } from "./perf-utils.ts";

const REQUEST_COUNT = 500;

describe("bridge rpc performance", () => {
  it("handles 500 rpc requests within latency and throughput thresholds", async () => {
    const thresholds = readPerfThresholds();
    const bridge = await createBridgeHttpServer({
      token: "perf-token",
      handleRpc: async (_method, params) => ({ ok: true, params }),
      rpcTimeoutMs: 15000,
    });

    try {
      const latencies: number[] = [];
      const start = nowMs();
      for (let index = 0; index < REQUEST_COUNT; index += 1) {
        const requestStart = nowMs();
        const response = await fetch(`${bridge.url}/rpc`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-pi-vscode-authorization": "perf-token",
          },
          body: JSON.stringify({
            method: "getEditorState",
            params: { index },
          }),
        });
        if (!response.ok) {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
        await response.json();
        latencies.push(nowMs() - requestStart);
      }
      const durationMs = nowMs() - start;
      const p95Ms = percentile(latencies, 95);
      const throughputRps = REQUEST_COUNT / (durationMs / 1000);
      console.info(
        `[perf] bridge-rpc count=${REQUEST_COUNT} durationMs=${durationMs.toFixed(3)} p95Ms=${p95Ms.toFixed(6)} throughputRps=${throughputRps.toFixed(3)}`,
      );

      expect(p95Ms).toBeLessThanOrEqual(thresholds.bridgeRpcP95Ms);
      expect(throughputRps).toBeGreaterThanOrEqual(thresholds.bridgeRpcMinThroughputRps);
    } finally {
      await bridge.dispose();
    }
  });
});
