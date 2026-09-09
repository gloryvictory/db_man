import { Router } from 'express';
import { listAudit, countAudit, clearAudit } from '../sqlite';

const r = Router();

r.get('/', (req, res) => {
  const q = req.query as Record<string, string>;
  const limit = Math.min(parseInt(q.limit, 10) || 100, 1000);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  res.json({ rows: listAudit(limit, offset), total: countAudit(), limit, offset });
});

r.delete('/', (_req, res) => {
  clearAudit();
  res.json({ ok: true });
});

export default r;
