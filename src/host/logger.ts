export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LoggerContext {
  scope: string;
  message: string;
  correlationId?: string;
  details?: unknown;
}

export interface Logger {
  error(context: LoggerContext): void;
  warn(context: LoggerContext): void;
  info(context: LoggerContext): void;
  debug(context: LoggerContext): void;
}

export function createLogger(options: {
  level: LogLevel;
  write(line: string): void;
  now?: () => Date;
}): Logger {
  const now = options.now ?? (() => new Date());
  return {
    error(context) {
      log("error", context);
    },
    warn(context) {
      log("warn", context);
    },
    info(context) {
      log("info", context);
    },
    debug(context) {
      log("debug", context);
    },
  };

  function log(level: LogLevel, context: LoggerContext): void {
    if (!shouldLog(options.level, level)) return;
    const entry = {
      timestamp: now().toISOString(),
      level,
      scope: context.scope,
      message: context.message,
      correlationId: context.correlationId,
      details: context.details,
    };
    options.write(JSON.stringify(entry));
  }
}

export function normalizeLogLevel(level: unknown): LogLevel {
  if (level === "error" || level === "warn" || level === "info" || level === "debug") {
    return level;
  }
  return "info";
}

function shouldLog(configured: LogLevel, incoming: LogLevel): boolean {
  return levelWeight(incoming) <= levelWeight(configured);
}

function levelWeight(level: LogLevel): number {
  if (level === "error") return 0;
  if (level === "warn") return 1;
  if (level === "info") return 2;
  return 3;
}
