import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  user_id: string | null;
  created_at: string;
}

export interface User {
  id: string;
  fio: string;
  login: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface UserRow extends User {
  password_hash: string;
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
  user_id: string | null;
}

export interface AuditEntry {
  user_id: string | null;
  username: string | null; // логин пользователя приложения
  action: string;
  target: string | null;
  detail: string | null;
  status: 'ok' | 'error';
  error: string | null;
}

let db: DatabaseSync;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

export function initDb(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      fio TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 5432,
      database TEXT NOT NULL,
      username TEXT NOT NULL,
      user_id TEXT,
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
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS connection_secrets (
      connection_id TEXT PRIMARY KEY,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      status TEXT NOT NULL,
      error TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // миграции для существующих БД
  ensureColumn('query_log', 'host', 'TEXT');
  ensureColumn('query_log', 'port', 'INTEGER');
  ensureColumn('query_log', 'username', 'TEXT');
  ensureColumn('query_log', 'dsn', 'TEXT');
  ensureColumn('query_log', 'user_id', 'TEXT');
  ensureColumn('connections', 'user_id', 'TEXT');
  ensureColumn('audit_log', 'user_id', 'TEXT');

  seedAdmin();

  return db;
}

function ensureColumn(table: string, col: string, def: string): void {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!info.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

function seedAdmin(): void {
  const n = Number((db.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n);
  if (n === 0) {
    const id = randomUUID();
    db.prepare('INSERT INTO users (id, fio, login, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
      id,
      'Администратор',
      'admin',
      hashPassword('admin'),
      'admin'
    );
    // существующие подключения, созданные до появления пользователей, отдаём админу
    db.prepare('UPDATE connections SET user_id = ? WHERE user_id IS NULL').run(id);
  }
}

// ---------- пользователи ----------

function toUser(r: UserRow | User): User {
  return { id: r.id, fio: r.fio, login: r.login, role: r.role, created_at: r.created_at };
}

export function createUser(fio: string, login: string, passwordHash: string, role: 'admin' | 'user'): User {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id, fio, login, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(id, fio, login, passwordHash, role);
  return getUserById(id)!;
}

export function getUserByLogin(login: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE login = ?').get(login) as unknown as UserRow | undefined;
}

export function getUserById(id: string): User | undefined {
  const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
  return r ? toUser(r) : undefined;
}

export function listUsers(): User[] {
  return (db.prepare('SELECT id, fio, login, role, created_at FROM users ORDER BY created_at').all() as unknown as UserRow[]).map(toUser);
}

export function updateUser(id: string, data: { fio?: string; passwordHash?: string; role?: 'admin' | 'user' }): User | undefined {
  const cur = getUserById(id);
  if (!cur) return undefined;
  const fio = data.fio ?? cur.fio;
  const role = data.role ?? cur.role;
  if (data.passwordHash) {
    db.prepare('UPDATE users SET fio = ?, role = ?, password_hash = ? WHERE id = ?').run(fio, role, data.passwordHash, id);
  } else {
    db.prepare('UPDATE users SET fio = ?, role = ? WHERE id = ?').run(fio, role, id);
  }
  return getUserById(id);
}

export function deleteUser(id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  // удаляем подключения пользователя
  const conns = db.prepare('SELECT id FROM connections WHERE user_id = ?').all(id) as unknown as { id: string }[];
  for (const c of conns) {
    db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').run(c.id);
  }
  db.prepare('DELETE FROM connections WHERE user_id = ?').run(id);
}

export function countUsers(): number {
  return Number((db.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n);
}

// ---------- сессии ----------

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 дней

export function createSession(token: string, userId: string): void {
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
}

export function getSessionUser(token: string): User | undefined {
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return undefined;
  }
  return getUserById(row.user_id);
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---------- подключения (с привязкой к пользователю) ----------

export function listConnections(userId: string, isAdmin: boolean): StoredConnection[] {
  const sql = isAdmin
    ? 'SELECT * FROM connections ORDER BY created_at'
    : 'SELECT * FROM connections WHERE user_id = ? ORDER BY created_at';
  const params = isAdmin ? [] : [userId];
  return db.prepare(sql).all(...params) as unknown as StoredConnection[];
}

export function getConnection(id: string): StoredConnection | undefined {
  return db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as unknown as StoredConnection | undefined;
}

export function createConnection(data: Omit<StoredConnection, 'id' | 'created_at' | 'user_id'>, userId: string): StoredConnection {
  const id = randomUUID();
  db.prepare('INSERT INTO connections (id, name, host, port, database, username, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    data.name,
    data.host,
    data.port,
    data.database,
    data.username,
    userId
  );
  return getConnection(id)!;
}

export function updateConnection(
  id: string,
  data: Partial<Omit<StoredConnection, 'id' | 'created_at' | 'user_id'>>
): StoredConnection | undefined {
  const cur = getConnection(id);
  if (!cur) return undefined;
  const next = { ...cur, ...data };
  db.prepare('UPDATE connections SET name = ?, host = ?, port = ?, database = ?, username = ? WHERE id = ?').run(
    next.name,
    next.host,
    next.port,
    next.database,
    next.username,
    id
  );
  return getConnection(id);
}

export function deleteConnection(id: string): void {
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').run(id);
}

// ---------- журнал запросов (с фильтрацией по пользователю) ----------

export function logQuery(entry: LogEntry): void {
  db.prepare(
    `INSERT INTO query_log (connection_id, database, host, port, username, dsn, query, duration_ms, rows, error, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    entry.error,
    entry.user_id
  );
}

function scopedWhere(isAdmin: boolean, col = 'user_id'): string {
  return isAdmin ? '' : ` WHERE ${col} = ?`;
}

export function listLogs(limit: number | undefined, offset: number | undefined, userId: string, isAdmin: boolean): unknown[] {
  let sql = `SELECT * FROM query_log${scopedWhere(isAdmin)} ORDER BY id DESC`;
  const params: (string | number)[] = [];
  if (!isAdmin) params.push(userId);
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

export function countLogs(userId: string, isAdmin: boolean): number {
  const sql = `SELECT count(*) AS n FROM query_log${scopedWhere(isAdmin)}`;
  const row = db.prepare(sql).get(...(isAdmin ? [] : [userId])) as { n: number };
  return Number(row.n);
}

export function clearLogs(userId: string, isAdmin: boolean): void {
  const sql = `DELETE FROM query_log${scopedWhere(isAdmin)}`;
  db.prepare(sql).run(...(isAdmin ? [] : [userId]));
}

// ---------- сохранённые пароли подключений ----------

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

// ---------- аудит (с фильтрацией по пользователю) ----------

export function logAudit(entry: AuditEntry): void {
  db.prepare(
    `INSERT INTO audit_log (username, action, target, detail, status, error, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(entry.username, entry.action, entry.target, entry.detail, entry.status, entry.error, entry.user_id);
}

export function listAudit(limit: number | undefined, offset: number | undefined, userId: string, isAdmin: boolean): unknown[] {
  let sql = `SELECT * FROM audit_log${scopedWhere(isAdmin)} ORDER BY id DESC`;
  const params: (string | number)[] = [];
  if (!isAdmin) params.push(userId);
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

export function countAudit(userId: string, isAdmin: boolean): number {
  const sql = `SELECT count(*) AS n FROM audit_log${scopedWhere(isAdmin)}`;
  const row = db.prepare(sql).get(...(isAdmin ? [] : [userId])) as { n: number };
  return Number(row.n);
}

export function clearAudit(userId: string, isAdmin: boolean): void {
  const sql = `DELETE FROM audit_log${scopedWhere(isAdmin)}`;
  db.prepare(sql).run(...(isAdmin ? [] : [userId]));
}
