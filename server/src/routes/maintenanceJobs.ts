import { Router } from 'express';
import type { Request } from 'express';
import {
  listMaintenanceJobs,
  getMaintenanceJob,
  createMaintenanceJob,
  updateMaintenanceJob,
  deleteMaintenanceJob,
  setMaintenanceJobEnabled,
  setMaintenanceJobRun,
  listMaintenanceRuns,
  countMaintenanceRuns,
  getMaintenanceStats,
  getConnection,
} from '../sqlite';
import { computeNextRun, validateSchedule, runMaintenanceJob, badRequest } from '../maintenance';

const r = Router();

const JOB_TYPES = ['vacuum', 'analyze', 'vacuum_analyze', 'reindex'];
const SCHEDULE_TYPES = ['daily', 'weekly', 'hours'];

function ensureOwnership(req: Request, connectionId: string): void {
  if (req.user!.role === 'admin') return;
  const conn = getConnection(connectionId);
  if (!conn || conn.user_id !== req.user!.id) {
    const err = new Error('Нет доступа к подключению') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

function parseJobBody(req: Request): {
  connection_id: string;
  database: string;
  job_type: 'vacuum' | 'analyze' | 'vacuum_analyze' | 'reindex';
  schedule_type: 'daily' | 'weekly' | 'hours';
  schedule_value: string;
  enabled: boolean;
  catch_up: boolean;
} {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const connection_id = String(b.connection_id ?? '');
  const database = String(b.database ?? '').trim();
  const job_type = String(b.job_type ?? '');
  const schedule_type = String(b.schedule_type ?? '');
  const schedule_value = String(b.schedule_value ?? '').trim();
  if (!connection_id) throw badRequest('Укажите подключение');
  if (!database) throw badRequest('Укажите базу данных');
  if (!JOB_TYPES.includes(job_type)) throw badRequest('Неизвестный тип операции');
  if (!SCHEDULE_TYPES.includes(schedule_type)) throw badRequest('Неизвестный тип расписания');
  validateSchedule(schedule_type, schedule_value);
  ensureOwnership(req, connection_id);
  return {
    connection_id,
    database,
    job_type: job_type as 'vacuum' | 'analyze' | 'vacuum_analyze' | 'reindex',
    schedule_type: schedule_type as 'daily' | 'weekly' | 'hours',
    schedule_value,
    enabled: b.enabled !== false,
    catch_up: b.catch_up !== false,
  };
}

r.get('/', (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  res.json(listMaintenanceJobs(req.user!.id, isAdmin));
});

r.get('/runs', (req, res) => {
  const q = req.query as Record<string, string>;
  const jobId = q.jobId || undefined;
  const limit = Math.min(parseInt(q.limit, 10) || 100, 1000);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  const isAdmin = req.user!.role === 'admin';
  res.json({
    rows: listMaintenanceRuns(jobId, limit, offset, req.user!.id, isAdmin),
    total: countMaintenanceRuns(jobId, req.user!.id, isAdmin),
    limit,
    offset,
  });
});

r.get('/stats', (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  res.json(getMaintenanceStats(req.user!.id, isAdmin));
});

r.post('/', (req, res, next) => {
  try {
    const d = parseJobBody(req);
    const nextRun = computeNextRun(d.schedule_type, d.schedule_value, new Date());
    const job = createMaintenanceJob({ ...d, next_run_at: nextRun.toISOString() });
    res.status(201).json(job);
  } catch (e) {
    next(e);
  }
});

r.put('/:id', (req, res, next) => {
  try {
    const job = getMaintenanceJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Задание не найдено' });
    ensureOwnership(req, job.connection_id);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const database = b.database !== undefined ? String(b.database).trim() : job.database;
    const job_type = b.job_type !== undefined ? String(b.job_type) : job.job_type;
    const schedule_type = b.schedule_type !== undefined ? String(b.schedule_type) : job.schedule_type;
    const schedule_value = b.schedule_value !== undefined ? String(b.schedule_value).trim() : job.schedule_value;
    if (!database) throw badRequest('Укажите базу данных');
    if (!JOB_TYPES.includes(job_type)) throw badRequest('Неизвестный тип операции');
    if (!SCHEDULE_TYPES.includes(schedule_type)) throw badRequest('Неизвестный тип расписания');
    validateSchedule(schedule_type, schedule_value);
    const updated = updateMaintenanceJob(req.params.id, {
      database,
      job_type: job_type as 'vacuum' | 'analyze' | 'vacuum_analyze' | 'reindex',
      schedule_type: schedule_type as 'daily' | 'weekly' | 'hours',
      schedule_value,
      enabled: b.enabled !== undefined ? Boolean(b.enabled) : job.enabled,
      catch_up: b.catch_up !== undefined ? Boolean(b.catch_up) : job.catch_up,
    });
    if (schedule_type !== job.schedule_type || schedule_value !== job.schedule_value) {
      // пересчитать следующий запуск
      setMaintenanceJobRun(req.params.id, job.last_run_at ?? new Date().toISOString(), computeNextRun(schedule_type, schedule_value, new Date()).toISOString());
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

r.delete('/:id', (req, res, next) => {
  try {
    const job = getMaintenanceJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Задание не найдено' });
    ensureOwnership(req, job.connection_id);
    deleteMaintenanceJob(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post('/:id/toggle', (req, res, next) => {
  try {
    const job = getMaintenanceJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Задание не найдено' });
    ensureOwnership(req, job.connection_id);
    setMaintenanceJobEnabled(req.params.id, !job.enabled);
    res.json({ ok: true, enabled: !job.enabled });
  } catch (e) {
    next(e);
  }
});

r.post('/:id/run', async (req, res, next) => {
  try {
    const job = getMaintenanceJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Задание не найдено' });
    ensureOwnership(req, job.connection_id);
    const result = await runMaintenanceJob(req.params.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default r;
