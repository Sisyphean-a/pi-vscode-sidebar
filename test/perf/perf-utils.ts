import { performance } from "node:perf_hooks";

export interface PerfThresholds {
  sidebarStreamP95Ms: number;
  bridgeRpcP95Ms: number;
  bridgeRpcMinThroughputRps: number;
}

export function nowMs(): number {
  return performance.now();
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

export function readPerfThresholds(): PerfThresholds {
  return {
    sidebarStreamP95Ms: readEnvNumber("PERF_SIDEBAR_STREAM_P95_MS", 2),
    bridgeRpcP95Ms: readEnvNumber("PERF_BRIDGE_RPC_P95_MS", 30),
    bridgeRpcMinThroughputRps: readEnvNumber("PERF_BRIDGE_RPC_MIN_RPS", 40),
  };
}

function readEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
