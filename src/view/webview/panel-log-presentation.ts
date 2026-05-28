import { parsePanelLogLine } from "./panel-log-message-parsing.ts";

export type PanelLogLevelTone = "plain" | "debug" | "info" | "warn" | "error";

export interface PanelLogPresentation {
  content: string;
  levelLabel: string;
  levelTone: PanelLogLevelTone;
  message: string;
  summaryMeta: readonly string[];
  summaryTime: string;
  timestampIso: string;
}

interface CreatePanelLogPresentationOptions {
  now?: Date;
  timeZone?: string;
}

interface DateParts {
  day: string;
  hour: string;
  millisecond: string;
  minute: string;
  month: string;
  second: string;
  year: string;
}

export function createPanelLogPresentation(
  line: string,
  options: CreatePanelLogPresentationOptions = {},
): PanelLogPresentation {
  const payload = parsePanelLogLine(line);
  if (!payload) return createPlainTextPresentation(line);
  return createStructuredPresentation(payload, line, options);
}

function createPlainTextPresentation(line: string): PanelLogPresentation {
  return {
    content: line,
    levelLabel: "",
    levelTone: "plain",
    message: line,
    summaryMeta: [],
    summaryTime: "",
    timestampIso: "",
  };
}

function createStructuredPresentation(
  payload: Record<string, unknown>,
  line: string,
  options: CreatePanelLogPresentationOptions,
): PanelLogPresentation {
  const timestampIso = readText(payload.timestamp);
  const rawLevel = readText(payload.level);
  const level = createLevelPresentation(rawLevel);
  const summaryMeta = [
    readText(payload.scope),
    formatCorrelationId(readText(payload.correlationId)),
  ].filter(Boolean);

  return {
    content: JSON.stringify(payload, null, 2),
    levelLabel: level.levelLabel,
    levelTone: level.levelTone,
    message: readText(payload.message) || line,
    summaryMeta,
    summaryTime: formatSummaryTimestamp(timestampIso, options),
    timestampIso,
  };
}

function createLevelPresentation(rawLevel: string): {
  levelLabel: string;
  levelTone: PanelLogLevelTone;
} {
  const normalized = rawLevel.toLowerCase();
  if (normalized === "debug") return { levelLabel: "DEBUG", levelTone: "debug" };
  if (normalized === "info") return { levelLabel: "INFO", levelTone: "info" };
  if (normalized === "warn") return { levelLabel: "WARN", levelTone: "warn" };
  if (normalized === "error") return { levelLabel: "ERROR", levelTone: "error" };
  if (!rawLevel) return { levelLabel: "", levelTone: "plain" };
  return { levelLabel: rawLevel.toUpperCase(), levelTone: "info" };
}

function formatCorrelationId(correlationId: string): string {
  if (!correlationId) return "";
  return `#${correlationId.slice(0, 8)}`;
}

function formatSummaryTimestamp(
  timestampIso: string,
  options: CreatePanelLogPresentationOptions,
): string {
  const timestamp = parseTimestamp(timestampIso);
  if (!timestamp) return "";
  const current = options.now ?? new Date();
  const timestampParts = readDateParts(timestamp, options.timeZone);
  const currentParts = readDateParts(current, options.timeZone);
  if (isSameDay(timestampParts, currentParts)) {
    return `${timestampParts.hour}:${timestampParts.minute}:${timestampParts.second}.${timestampParts.millisecond}`;
  }
  const datePrefix =
    timestampParts.year === currentParts.year
      ? `${timestampParts.month}-${timestampParts.day}`
      : `${timestampParts.year}-${timestampParts.month}-${timestampParts.day}`;
  return `${datePrefix} ${timestampParts.hour}:${timestampParts.minute}`;
}

function parseTimestamp(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isSameDay(left: DateParts, right: DateParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function readDateParts(date: Date, timeZone: string | undefined): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    fractionalSecondDigits: 3,
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  return {
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    millisecond: readPart(parts, "fractionalSecond"),
    minute: readPart(parts, "minute"),
    month: readPart(parts, "month"),
    second: readPart(parts, "second"),
    year: readPart(parts, "year"),
  };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
