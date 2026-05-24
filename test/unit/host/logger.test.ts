import { describe, expect, it } from "vitest";
import { createLogger, normalizeLogLevel } from "../../../src/host/logger.ts";

describe("logger", () => {
  it("filters low-priority logs by configured level", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "warn",
      write(line) {
        lines.push(line);
      },
      now: () => new Date("2026-05-24T00:00:00.000Z"),
    });

    logger.debug({ scope: "host", message: "debug message" });
    logger.info({ scope: "host", message: "info message" });
    logger.warn({ scope: "host", message: "warn message" });
    logger.error({ scope: "host", message: "error message" });

    const entries = lines.map(parseLine);
    expect(entries.map((entry) => entry.level)).toEqual(["warn", "error"]);
  });

  it("emits structured json with correlationId when present", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "debug",
      write(line) {
        lines.push(line);
      },
      now: () => new Date("2026-05-24T00:00:00.000Z"),
    });

    logger.debug({
      scope: "rpc",
      message: "command sent",
      correlationId: "ui-abc",
      details: { command: "prompt" },
    });

    const entry = parseLine(lines[0]);
    expect(entry).toEqual({
      timestamp: "2026-05-24T00:00:00.000Z",
      level: "debug",
      scope: "rpc",
      message: "command sent",
      correlationId: "ui-abc",
      details: { command: "prompt" },
    });
  });

  it("normalizes invalid log level to info", () => {
    expect(normalizeLogLevel("debug")).toBe("debug");
    expect(normalizeLogLevel("invalid")).toBe("info");
    expect(normalizeLogLevel(undefined)).toBe("info");
  });
});

function parseLine(line: string | undefined): Record<string, unknown> {
  if (!line) throw new Error("Missing log line");
  return JSON.parse(line) as Record<string, unknown>;
}
