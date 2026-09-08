import { Router } from 'express';
import { getTableService, reindexTable, reindexAllTable, vacuumTable, analyzeTable, createSpatialIndex } from '../db';

const r = Router();

r.get('/:connId/databases/:db/schemas/:schema/tables/:table/service', async (req, res, next) => {
  try {
    res.json(await getTableService(req.params.connId, req.params.db, req.params.schema, req.params.table));
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/tables/:table/service/reindex', async (req, res, next) => {
  try {
    const { index } = (req.body ?? {}) as Record<string, unknown>;
    if (!index || typeof index !== 'string') {
      return res.status(400).json({ error: 'Укажите имя индекса' });
    }
    await reindexTable(req.params.connId, req.params.db, req.params.schema, req.params.table, index);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/tables/:table/service/reindex-table', async (req, res, next) => {
  try {
    await reindexAllTable(req.params.connId, req.params.db, req.params.schema, req.params.table);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/tables/:table/service/vacuum', async (req, res, next) => {
  try {
    await vacuumTable(req.params.connId, req.params.db, req.params.schema, req.params.table);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/tables/:table/service/analyze', async (req, res, next) => {
  try {
    await analyzeTable(req.params.connId, req.params.db, req.params.schema, req.params.table);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/tables/:table/service/spatial-index', async (req, res, next) => {
  try {
    const { column } = (req.body ?? {}) as Record<string, unknown>;
    if (!column || typeof column !== 'string') {
      return res.status(400).json({ error: 'Укажите имя колонки' });
    }
    await createSpatialIndex(req.params.connId, req.params.db, req.params.schema, req.params.table, column);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
