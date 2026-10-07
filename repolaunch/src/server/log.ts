// Strukturierte Logs ohne Schlüssel, Tokens oder Repository-Inhalte.

type Level = "info" | "warn" | "error";

const FORBIDDEN_KEYS = /key|token|secret|authorization|content|text|readme|body/i;

export function log(level: Level, msg: string, fields: Record<string, string | number | boolean | null | undefined> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    safe[k] = typeof v === "string" ? v.slice(0, 200) : v;
  }
  if (process.env.NODE_ENV === "test" && process.env.REPOLAUNCH_LOG !== "1") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...safe });
  if (level === "error") console.error(line);
  else console.log(line);
}
