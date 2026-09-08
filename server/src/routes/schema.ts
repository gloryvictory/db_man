import { Router } from 'express';
import { getSchemaInfo, getSchemaAnalysis } from '../db';

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

export default r;
