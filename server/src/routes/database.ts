import { Router } from 'express';
import { getDatabaseInfo, getDatabaseStats, vacuumDatabase, analyzeDatabase, reindexDatabase } from '../db';

const r = Router();

r.get('/:connId/databases/:db/info', async (req, res, next) => {
  try {
    res.json(await getDatabaseInfo(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/service', async (req, res, next) => {
  try {
    res.json(await getDatabaseStats(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/vacuum', async (req, res, next) => {
  try {
    await vacuumDatabase(req.params.connId, req.params.db);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/analyze', async (req, res, next) => {
  try {
    await analyzeDatabase(req.params.connId, req.params.db);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/reindex', async (req, res, next) => {
  try {
    await reindexDatabase(req.params.connId, req.params.db);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
