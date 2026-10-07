import "server-only";
const SECRET = /(key|token|secret|password|authorization|code)/i;
function redact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) ? "[redacted]" : redact(x)]));
  return v;
}
type Level = "debug" | "info" | "warn" | "error";
const emit = (level: Level, msg: string, ctx?: Record<string, unknown>) =>
  console[level === "debug" ? "log" : level](JSON.stringify({ t: new Date().toISOString(), level, msg, ...(ctx ? (redact(ctx) as object) : {}) }));
export const log = { debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c), info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c), error: (m: string, c?: Record<string, unknown>) => emit("error", m, c) };
