import { Router } from 'express';
import { getConnection } from '../sqlite';
import { listDatabases, listSchemas, listTables, getColumns, getStats, getOverview, searchObjects } from '../db';

const r = Router();

r.get('/:connId/databases', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.connId);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    res.json(await listDatabases(conn.id, conn.database));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas', async (req, res, next) => {
  try {
    res.json(await listSchemas(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas/:schema/tables', async (req, res, next) => {
  try {
    res.json(await listTables(req.params.connId, req.params.db, req.params.schema));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas/:schema/tables/:table/columns', async (req, res, next) => {
  try {
    res.json(await getColumns(req.params.connId, req.params.db, req.params.schema, req.params.table));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/stats', async (req, res, next) => {
  try {
    res.json(await getStats(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/overview', async (req, res, next) => {
  try {
    res.json(await getOverview(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/search', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? '';
    if (q.length < 2) return res.json({ tables: [], columns: [], indexes: [] });
    res.json(await searchObjects(req.params.connId, req.params.db, q));
  } catch (e) {
    next(e);
  }
});

export default r;
