import { Router } from 'express';
import { getDatabaseInfo, getDatabaseStats, getDatabaseAnalysis, getServerConfig, getDatabaseDdl, vacuumDatabase, analyzeDatabase, reindexDatabase } from '../db';
import { audited } from '../audit';

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

r.get('/:connId/databases/:db/analysis', async (req, res, next) => {
  try {
    res.json(await getDatabaseAnalysis(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/config', async (req, res, next) => {
  try {
    res.json(await getServerConfig(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/ddl', async (req, res, next) => {
  try {
    res.json({ ddl: await getDatabaseDdl(req.params.connId, req.params.db) });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/vacuum', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'VACUUM DATABASE', target: req.params.db },
      () => vacuumDatabase(req.params.connId, req.params.db)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/analyze', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'ANALYZE DATABASE', target: req.params.db },
      () => analyzeDatabase(req.params.connId, req.params.db)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/service/reindex', async (req, res, next) => {
  try {
    await audited(
      { connId: req.params.connId, action: 'REINDEX DATABASE', target: req.params.db },
      () => reindexDatabase(req.params.connId, req.params.db)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
