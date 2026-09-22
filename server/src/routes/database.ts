import { Router } from 'express';
import { getDatabaseInfo, getDatabaseStats, getDatabaseAnalysis, getColumnsList, getServerConfig, getDatabaseDdl, getDataQuality, getTablespaces, getSessions, getLocks, killBackend, getSlowQueries, runQuery, renameDatabase, vacuumDatabase, analyzeDatabase, reindexDatabase } from '../db';
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

r.get('/:connId/databases/:db/columns', async (req, res, next) => {
  try {
    res.json(await getColumnsList(req.params.connId, req.params.db));
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

r.get('/:connId/databases/:db/tablespaces', async (req, res, next) => {
  try {
    res.json(await getTablespaces(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/sessions', async (req, res, next) => {
  try {
    res.json(await getSessions(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/locks', async (req, res, next) => {
  try {
    res.json(await getLocks(req.params.connId, req.params.db));
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/sessions/:pid/cancel', async (req, res, next) => {
  const pid = parseInt(req.params.pid, 10);
  if (!Number.isInteger(pid)) return res.status(400).json({ error: 'Неверный pid' });
  try {
    await audited(
      { connId: req.params.connId, action: 'CANCEL BACKEND', target: `pid ${pid}` },
      () => killBackend(req.params.connId, req.params.db, pid, 'cancel')
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/sessions/:pid/terminate', async (req, res, next) => {
  const pid = parseInt(req.params.pid, 10);
  if (!Number.isInteger(pid)) return res.status(400).json({ error: 'Неверный pid' });
  try {
    await audited(
      { connId: req.params.connId, action: 'TERMINATE BACKEND', target: `pid ${pid}` },
      () => killBackend(req.params.connId, req.params.db, pid, 'terminate')
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.get('/:connId/databases/:db/slow-queries', async (req, res, next) => {
  const q = req.query as Record<string, string>;
  const limit = Math.min(parseInt(q.limit, 10) || 50, 500);
  try {
    res.json(await getSlowQueries(req.params.connId, req.params.db, limit));
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/query', async (req, res, next) => {
  const { sql } = (req.body ?? {}) as Record<string, unknown>;
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return res.status(400).json({ error: 'Введите SQL-запрос' });
  }
  try {
    res.json(await runQuery(req.params.connId, req.params.db, sql.trim()));
  } catch (e) {
    next(e);
  }
});

r.post('/:connId/databases/:db/rename', async (req, res, next) => {
  const { newName } = (req.body ?? {}) as Record<string, unknown>;
  if (!newName || typeof newName !== 'string' || !newName.trim()) {
    return res.status(400).json({ error: 'Укажите новое имя базы данных' });
  }
  const nn = newName.trim();
  if (nn === req.params.db) return res.status(400).json({ error: 'Новое имя совпадает с текущим' });
  try {
    await audited(
      { connId: req.params.connId, action: 'RENAME DATABASE', target: `${req.params.db} → ${nn}` },
      () => renameDatabase(req.params.connId, req.params.db, nn)
    );
    res.json({ ok: true });
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

r.get('/:connId/databases/:db/data-quality', async (req, res, next) => {
  try {
    res.json(await getDataQuality(req.params.connId, req.params.db));
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
