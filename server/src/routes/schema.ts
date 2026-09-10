import { Router } from 'express';
import {
  getSchemaInfo,
  getSchemaAnalysis,
  getSchemaStats,
  vacuumSchema,
  analyzeSchema,
  reindexSchema,
  getDatabaseDdl,
} from '../db';
import { audited } from '../audit';

const r = Router();

r.get('/:connId/databases/:db/schemas/:schema/info', async (req, res, next) => {
  try {
    res.json(await getSchemaInfo(req.params.connId, req.params.db, req.params.schema));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas/:schema/analysis', async (req, res, next) => {
  try {
    res.json(await getSchemaAnalysis(req.params.connId, req.params.db, req.params.schema));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas/:schema/service', async (req, res, next) => {
  try {
    res.json(await getSchemaStats(req.params.connId, req.params.db, req.params.schema));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/schemas/:schema/ddl', async (req, res, next) => {
  try {
    res.json({ ddl: await getDatabaseDdl(req.params.connId, req.params.db, req.params.schema) });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/service/vacuum', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'VACUUM SCHEMA', target: req.params.schema },
      () => vacuumSchema(req.params.connId, req.params.db, req.params.schema)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/service/analyze', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'ANALYZE SCHEMA', target: req.params.schema },
      () => analyzeSchema(req.params.connId, req.params.db, req.params.schema)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/service/reindex', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'REINDEX SCHEMA', target: req.params.schema },
      () => reindexSchema(req.params.connId, req.params.db, req.params.schema)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
