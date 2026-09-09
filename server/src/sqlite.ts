import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  created_at: string;
}

export interface LogEntry {
  connection_id: string | null;
  database: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  dsn: string | null;
  query: string;
  duration_ms: number;
  rows: number;
  error: string | null;
}

let db: DatabaseSync;

export function initDb(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 5432,
      database TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS query_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id TEXT,
      database TEXT,
      host TEXT,
      port INTEGER,
      username TEXT,
      dsn TEXT,
      query TEXT,
      duration_ms REAL,
      rows INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS connection_secrets (
      connection_id TEXT PRIMARY KEY,
      password TEXT NOT NULL
    );
  `);

  // миграция для существующих БД (журнал без новых колонок)
  ensureColumn('query_log', 'host', 'TEXT');
  ensureColumn('query_log', 'port', 'INTEGER');
  ensureColumn('query_log', 'username', 'TEXT');
  ensureColumn('query_log', 'dsn', 'TEXT');

  return db;
}

function ensureColumn(table: string, col: string, def: string): void {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!info.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

export function listConnections(): StoredConnection[] {
  return db.prepare('SELECT * FROM connections ORDER BY created_at').all() as unknown as StoredConnection[];
}

export function getConnection(id: string): StoredConnection | undefined {
  return db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as unknown as StoredConnection | undefined;
}

export function createConnection(data: Omit<StoredConnection, 'id' | 'created_at'>): StoredConnection {
  const id = randomUUID();
  db.prepare('INSERT INTO connections (id, name, host, port, database, username) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, data.name, data.host, data.port, data.database, data.username);
  return getConnection(id)!;
}

export function updateConnection(
  id: string,
  data: Partial<Omit<StoredConnection, 'id' | 'created_at'>>
): StoredConnection | undefined {
  const cur = getConnection(id);
  if (!cur) return undefined;
  const next = { ...cur, ...data };
  db.prepare('UPDATE connections SET name = ?, host = ?, port = ?, database = ?, username = ? WHERE id = ?')
    .run(next.name, next.host, next.port, next.database, next.username, id);
  return getConnection(id);
}

export function deleteConnection(id: string): void {
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').run(id);
}

export function logQuery(entry: LogEntry): void {
  db.prepare(
    `INSERT INTO query_log (connection_id, database, host, port, username, dsn, query, duration_ms, rows, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.connection_id,
    entry.database,
    entry.host,
    entry.port,
    entry.username,
    entry.dsn,
    entry.query,
    entry.duration_ms,
    entry.rows,
    entry.error
  );
}

export function listLogs(limit?: number, offset?: number): unknown[] {
  let sql = 'SELECT * FROM query_log ORDER BY id DESC';
  const params: number[] = [];
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  if (offset !== undefined) {
    sql += ' OFFSET ?';
    params.push(offset);
  }
  return db.prepare(sql).all(...params) as unknown[];
}

export function countLogs(): number {
  const row = db.prepare('SELECT count(*) AS n FROM query_log').get() as { n: number };
  return Number(row.n);
}

export function clearLogs(): void {
  db.prepare('DELETE FROM query_log').run();
}

export function savePassword(connectionId: string, password: string): void {
  db.prepare('INSERT OR REPLACE INTO connection_secrets (connection_id, password) VALUES (?, ?)').run(connectionId, password);
}

export function getSavedPassword(connectionId: string): string | undefined {
  const row = db.prepare('SELECT password FROM connection_secrets WHERE connection_id = ?').get(connectionId) as
    | { password: string }
    | undefined;
  return row?.password;
}

export function clearSavedPassword(connectionId: string): void {
  db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').run(connectionId);
}

export function hasSavedPassword(connectionId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM connection_secrets WHERE connection_id = ?').get(connectionId));
}
