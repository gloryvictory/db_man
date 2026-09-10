import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { initDb, getConnection } from './sqlite';
import connectionsRouter from './routes/connections';
import catalogRouter from './routes/catalog';
import tableRouter from './routes/table';
import exportRouter from './routes/export';
import maintenanceRouter from './routes/maintenance';
import databaseRouter from './routes/database';
import schemaRouter from './routes/schema';
import logsRouter from './routes/logs';
import auditRouter from './routes/audit';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { requireAuth } from './auth';

initDb(config.sqlitePath);

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', requireAuth);

// проверка владения подключением для всех /api/connections/:id/*
app.use('/api/connections/:connId', (req, res, next) => {
  const conn = getConnection(req.params.connId);
  if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
  if (req.user!.role !== 'admin' && conn.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  next();
});

app.use('/api/connections', connectionsRouter);
app.use('/api/connections', catalogRouter);
app.use('/api/connections', tableRouter);
app.use('/api/connections', exportRouter);
app.use('/api/connections', maintenanceRouter);
app.use('/api/connections', databaseRouter);
app.use('/api/connections', schemaRouter);
app.use('/api/logs', logsRouter);
app.use('/api/audit', auditRouter);

// раздача собранного клиента (production)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const file = path.join(clientDist, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  next();
});

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err?.message || 'Internal server error' });
});

app.listen(config.port, config.host, () => {
  console.log(`[db_man] server listening on http://${config.host}:${config.port}`);
  console.log(`[db_man] sqlite: ${config.sqlitePath}`);
});
