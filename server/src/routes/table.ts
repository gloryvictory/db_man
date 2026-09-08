import { Router } from 'express';
import { getRows } from '../db';

const r = Router();

r.get('/:connId/databases/:db/schemas/:schema/tables/:table/rows', async (req, res, next) => {
  try {
    const { limit = '100', offset = '0', sort, dir, filter } = req.query as Record<string, string | undefined>;
    const data = await getRows(req.params.connId, req.params.db, req.params.schema, req.params.table, {
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0,
      sort: sort || undefined,
      dir: dir === 'desc' ? 'desc' : 'asc',
      filter: filter || undefined,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default r;
