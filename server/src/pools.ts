import { Pool } from 'pg';

export interface Secrets {
  host: string;
  port: number;
  user: string;
  password?: string;
}

// Пароли хранятся ТОЛЬКО здесь — в памяти сервера. Никогда не пишутся в SQLite и не отдаются в API.
const secrets = new Map<string, Secrets>();
const pools = new Map<string, Map<string, Pool>>();

export class NotConnectedError extends Error {
  status = 401;
  constructor() {
    super('Подключение не установлено');
  }
}

export function storeSecrets(connId: string, s: Secrets): void {
  secrets.set(connId, s);
}

export function getSecrets(connId: string): Secrets | undefined {
  return secrets.get(connId);
}

export function hasPassword(connId: string): boolean {
  return Boolean(secrets.get(connId)?.password);
}

export function dropConnection(connId: string): void {
  secrets.delete(connId);
  const perDb = pools.get(connId);
  if (perDb) {
    for (const p of perDb.values()) p.end().catch(() => {});
    pools.delete(connId);
  }
}

export function getPool(connId: string, database: string): Pool {
  const s = secrets.get(connId);
  if (!s) throw new NotConnectedError();

  let perDb = pools.get(connId);
  if (!perDb) {
    perDb = new Map();
    pools.set(connId, perDb);
  }

  let pool = perDb.get(database);
  if (!pool) {
    pool = new Pool({
      host: s.host,
      port: s.port,
      user: s.user,
      password: s.password,
      database,
      max: 5,
      connectionTimeoutMillis: 6000,
    });
    // не ронять сервер из-за простоя/обрыва клиента
    pool.on('error', () => {});
    perDb.set(database, pool);
  }
  return pool;
}
