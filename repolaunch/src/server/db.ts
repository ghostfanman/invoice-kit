// SQLite über das eingebaute node:sqlite (keine nativen Abhängigkeiten).
// Ein einzelner Prozess besitzt die Datenbank; WAL erlaubt parallele Lesezugriffe.

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

export type Db = DatabaseSyncType;

const SCHEMA_VERSION = 1;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
    input_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    heartbeat_at TEXT,
    error_code TEXT,
    ruleset_version TEXT,
    commit_sha TEXT,
    analyzed_at TEXT,
    snapshot_json TEXT,
    audit_json TEXT,
    ai_status TEXT NOT NULL DEFAULT 'none' CHECK (ai_status IN ('none','queued','running','done','failed')),
    ai_request_json TEXT,
    ai_result_json TEXT,
    ai_error_code TEXT,
    ai_runs INTEGER NOT NULL DEFAULT 0,
    ai_attempts INTEGER NOT NULL DEFAULT 0,
    ai_heartbeat_at TEXT
  );
  CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created_at);
  CREATE INDEX IF NOT EXISTS jobs_ai_status ON jobs(ai_status, updated_at);
  CREATE INDEX IF NOT EXISTS jobs_expires ON jobs(expires_at);
  CREATE TABLE IF NOT EXISTS job_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    at TEXT NOT NULL,
    type TEXT NOT NULL,
    detail TEXT
  );
  CREATE INDEX IF NOT EXISTS job_events_job ON job_events(job_id, id);
  CREATE TABLE IF NOT EXISTS http_cache (
    key TEXT PRIMARY KEY,
    etag TEXT NOT NULL,
    body BLOB NOT NULL,
    stored_at TEXT NOT NULL
  );
  `,
];

export function openDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  // getBuiltinModule umgeht den Bundler, der node:sqlite sonst ggf. nicht kennt.
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  const current = row ? Number(row.value) : 0;
  if (current > SCHEMA_VERSION) throw new Error(`Datenbankschema ${current} ist neuer als diese Version (${SCHEMA_VERSION})`);
  for (let v = current; v < SCHEMA_VERSION; v++) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(MIGRATIONS[v]!);
      db.prepare("INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(v + 1));
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
