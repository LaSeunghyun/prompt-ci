/**
 * SQLite schema migrations using user_version pragma for versioning.
 * Each migration is executed in a transaction.
 */

import type { Database } from 'better-sqlite3';

interface Migration {
  version: number;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS eval_runs (
        id            TEXT    PRIMARY KEY,
        started_at    TEXT    NOT NULL,
        finished_at   TEXT    NOT NULL,
        git_ref       TEXT,
        git_branch    TEXT,
        total_tests   INTEGER NOT NULL DEFAULT 0,
        passed        INTEGER NOT NULL DEFAULT 0,
        failed        INTEGER NOT NULL DEFAULT 0,
        avg_score     REAL    NOT NULL DEFAULT 0,
        total_cost    REAL    NOT NULL DEFAULT 0,
        total_duration_ms INTEGER NOT NULL DEFAULT 0,
        total_tokens  INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    version: 2,
    up: `
      CREATE TABLE IF NOT EXISTS test_results (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id        TEXT    NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
        prompt_name   TEXT    NOT NULL,
        test_name     TEXT    NOT NULL,
        passed        INTEGER NOT NULL DEFAULT 0,
        score         REAL    NOT NULL DEFAULT 0,
        duration_ms   INTEGER NOT NULL DEFAULT 0,
        model         TEXT    NOT NULL,
        provider      TEXT    NOT NULL,
        cost          REAL    NOT NULL DEFAULT 0,
        latency_ms    INTEGER NOT NULL DEFAULT 0,
        response_content TEXT NOT NULL DEFAULT '',
        finish_reason TEXT    NOT NULL DEFAULT '',
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens  INTEGER NOT NULL DEFAULT 0,
        test_case_json TEXT   NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
    `,
  },
  {
    version: 3,
    up: `
      CREATE TABLE IF NOT EXISTS assertion_results (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        test_result_id  INTEGER NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        assertion_type  TEXT    NOT NULL,
        passed          INTEGER NOT NULL DEFAULT 0,
        message         TEXT    NOT NULL DEFAULT '',
        reasoning       TEXT,
        score           REAL    NOT NULL DEFAULT 0,
        duration_ms     INTEGER NOT NULL DEFAULT 0,
        assertion_json  TEXT    NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_assertion_results_test_id ON assertion_results(test_result_id);
    `,
  },
];

/**
 * Run all pending migrations against the database.
 * Uses PRAGMA user_version to track the current schema version.
 */
export function runMigrations(db: Database): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.up);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}
