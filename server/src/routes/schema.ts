import { Router } from 'express';
import {
  getSchemaInfo,
  getSchemaAnalysis,
  getSchemaStats,
  vacuumSchema,
  analyzeSchema,
  reindexSchema,
} from '../db';

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

r.post('/:connId/databases/:db/schemas/:schema/service/vacuum', async (req, res, next) => {
  try {
    await vacuumSchema(req.params.connId, req.params.db, req.params.schema);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/service/analyze', async (req, res, next) => {
  try {
    await analyzeSchema(req.params.connId, req.params.db, req.params.schema);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/schemas/:schema/service/reindex', async (req, res, next) => {
  try {
    await reindexSchema(req.params.connId, req.params.db, req.params.schema);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
