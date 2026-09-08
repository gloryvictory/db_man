import { Router } from 'express';
import { listConnections, getConnection, createConnection, updateConnection, deleteConnection } from '../sqlite';
import { storeSecrets, getSecrets, hasPassword, dropConnection, getPool } from '../pools';

const r = Router();

function maskConnection(c: { id: string }): Record<string, unknown> {
  return { ...c, hasPassword: hasPassword(c.id) };
}

async function testConnection(connId: string, database: string) {
  try {
    const pool = getPool(connId, database);
    await pool.query('SELECT 1');
    return { connected: true as const, error: undefined };
  } catch (e) {
    dropConnection(connId);
    return { connected: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

r.get('/', (_req, res) => {
  res.json(listConnections().map(maskConnection));
});

r.post('/', async (req, res, next) => {
  try {
    const { name, host, port = 5432, database, username, password } = (req.body ?? {}) as Record<string, unknown>;
    if (!name || !host || !database || !username) {
      return res.status(400).json({ error: 'Заполните name, host, database и username' });
    }
    const conn = createConnection({
      name: String(name),
      host: String(host),
      port: Number(port) || 5432,
      database: String(database),
      username: String(username),
    });
    const pwd = typeof password === 'string' && password ? password : undefined;
    storeSecrets(conn.id, { host: conn.host, port: conn.port, user: conn.username, ...(pwd ? { password: pwd } : {}) });
    const test = await testConnection(conn.id, conn.database);
    res.status(201).json({ ...maskConnection(conn), connected: test.connected, error: test.error });
  } catch (e) {
    next(e);
  }
});

r.put('/:id', async (req, res, next) => {
  try {
    const { name, host, port, database, username, password } = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (name) patch.name = String(name);
    if (host) patch.host = String(host);
    if (port) patch.port = Number(port) || 5432;
    if (database) patch.database = String(database);
    if (username) patch.username = String(username);
    const conn = updateConnection(req.params.id, patch);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    if (typeof password === 'string' && password) {
      storeSecrets(conn.id, { host: conn.host, port: conn.port, user: conn.username, password });
    }
    res.json(maskConnection(conn));
  } catch (e) {
    next(e);
  }
});

r.delete('/:id', (req, res) => {
  dropConnection(req.params.id);
  deleteConnection(req.params.id);
  res.json({ ok: true });
});

r.post('/:id/connect', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const { password } = (req.body ?? {}) as Record<string, unknown>;
    const existing = getSecrets(conn.id);
    const pwd = typeof password === 'string' && password ? password : existing?.password;
    storeSecrets(conn.id, {
      host: conn.host,
      port: conn.port,
      user: conn.username,
      ...(pwd ? { password: pwd } : {}),
    });
    const test = await testConnection(conn.id, conn.database);
    if (test.connected) {
      res.json({ connected: true, ...maskConnection(conn) });
    } else {
      res.status(401).json({ connected: false, error: test.error });
    }
  } catch (e) {
    next(e);
  }
});

r.post('/:id/disconnect', (req, res) => {
  dropConnection(req.params.id);
  res.json({ ok: true });
});

export default r;
