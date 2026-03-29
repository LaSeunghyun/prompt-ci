/**
 * SQLite connection factory using better-sqlite3.
 * Enables WAL mode and runs schema migrations on open.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runMigrations } from './migrations.js';

export type { Database };

const DEFAULT_DB_PATH = '.promptci/history.db';

/**
 * Open (or create) a SQLite database at the given path.
 * Creates parent directories as needed, enables WAL mode,
 * sets a busy_timeout of 5000ms, and runs all pending migrations.
 */
export function createDatabase(dbPath?: string): Database.Database {
  const resolvedPath = resolve(dbPath ?? DEFAULT_DB_PATH);

  // Ensure the parent directory exists
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);

  // Performance and concurrency settings
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // Run schema migrations
  runMigrations(db);

  return db;
}
