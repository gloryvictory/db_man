import { Router } from 'express';
import { listLogs } from '../sqlite';

const r = Router();

r.get('/', (req, res) => {
  const limit = parseInt(String((req.query as Record<string, string>).limit), 10) || 200;
  res.json(listLogs(limit));
});

export default r;
