import { describe, expect, it } from "vitest";
import { nowMs, percentile, readPerfThresholds } from "./perf-utils.ts";

describe("sidebar stream performance", () => {
  it("processes 1000 stream events within p95 latency threshold", () => {
    const thresholds = readPerfThresholds();
    const latencies: number[] = [];
    const events = createSyntheticEvents(1000);

    const totalStart = nowMs();
    for (const event of events) {
      const start = nowMs();
      simulateEventRender(event);
      latencies.push(nowMs() - start);
    }
    const totalDurationMs = nowMs() - totalStart;
    const p95Ms = percentile(latencies, 95);
    console.info(
      `[perf] sidebar-stream count=${events.length} totalMs=${totalDurationMs.toFixed(3)} p95Ms=${p95Ms.toFixed(6)}`,
    );

    expect(p95Ms).toBeLessThanOrEqual(thresholds.sidebarStreamP95Ms);
    expect(totalDurationMs).toBeLessThanOrEqual(2000);
  });
});

function createSyntheticEvents(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    type: index % 5 === 0 ? "tool_execution_update" : "message_update",
    text: `event-${index}-${"x".repeat(64)}`,
    toolName: "vscode_get_editor_state",
    index,
  }));
}

function simulateEventRender(event: Record<string, unknown>): string {
  const type = typeof event.type === "string" ? event.type : "unknown";
  const text = typeof event.text === "string" ? event.text : "";
  const toolName = typeof event.toolName === "string" ? event.toolName : "";
  const preview = text.length > 160 ? `${text.slice(0, 160)}...` : text;
  if (type === "tool_execution_update") {
    return JSON.stringify({ type, toolName, preview });
  }
  return JSON.stringify({ type, preview });
}
