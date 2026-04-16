type Level = "info" | "warn" | "error" | "debug";

type LogContext = Record<string, unknown>;

function log(level: Level, message: string, ctx?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...ctx,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else if (level === "debug" && process.env.NODE_ENV === "production") {
    return;
  } else {
    console.log(JSON.stringify(payload));
  }
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),
  debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
};
