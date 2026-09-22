import {
  getConnection,
  getSavedPassword,
  getMaintenanceJob,
  getDueJobs,
  logMaintenanceRun,
  setMaintenanceJobRun,
  type MaintenanceJob,
  type MaintenanceRun,
} from './sqlite';
import { storeSecrets } from './pools';
import { vacuumDatabase, analyzeDatabase, reindexDatabase } from './db';

export function badRequest(msg: string): Error & { status: number } {
  const e = new Error(msg) as Error & { status: number };
  e.status = 400;
  return e;
}

/** Валидация расписания: daily «ЧЧ:ММ», weekly «д ЧЧ:ММ» (д=1..7, Пн..Вс), hours «N». */
export function validateSchedule(scheduleType: string, scheduleValue: string): void {
  if (scheduleType === 'daily') {
    if (!/^\d{2}:\d{2}$/.test(scheduleValue)) throw badRequest('Время должно быть в формате ЧЧ:ММ');
    const [h, m] = scheduleValue.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) throw badRequest('Неверное время');
  } else if (scheduleType === 'weekly') {
    if (!/^[1-7] \d{2}:\d{2}$/.test(scheduleValue)) throw badRequest('Формат: «день ЧЧ:ММ» (день 1..7, 1=Пн)');
    const [, t] = scheduleValue.split(' ');
    const [h, m] = t.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) throw badRequest('Неверное время');
  } else if (scheduleType === 'hours') {
    const n = parseInt(scheduleValue, 10);
    if (!/^\d+$/.test(scheduleValue) || n < 1) throw badRequest('Интервал должен быть целым числом часов (≥ 1)');
  } else {
    throw badRequest('Неизвестный тип расписания');
  }
}

/** Следующий запуск по расписанию (локальное время сервера). */
export function computeNextRun(scheduleType: string, scheduleValue: string, from: Date): Date {
  if (scheduleType === 'daily') {
    const [h, m] = scheduleValue.split(':').map(Number);
    const d = new Date(from);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }
  if (scheduleType === 'weekly') {
    const [dayStr, t] = scheduleValue.split(' ');
    const day = Number(dayStr); // 1=Пн … 7=Вс
    const [h, m] = t.split(':').map(Number);
    const d = new Date(from);
    d.setHours(h, m, 0, 0);
    const jsDay = day === 7 ? 0 : day; // JS: 0=Вс
    let diff = (jsDay - d.getDay() + 7) % 7;
    if (diff === 0 && d.getTime() <= from.getTime()) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }
  const n = parseInt(scheduleValue, 10) || 1;
  return new Date(from.getTime() + n * 3600_000);
}

async function executeJob(job: MaintenanceJob): Promise<{ status: 'ok' | 'error'; duration_ms: number; error: string | null }> {
  const conn = getConnection(job.connection_id);
  if (!conn) throw new Error('Подключение не найдено');
  const password = getSavedPassword(job.connection_id);
  if (!password) throw new Error('Нет сохранённого пароля — сохраните пароль в настройках подключения');
  // пароль поднимаем из connection_secrets в память (иначе после рестарта пула нет)
  storeSecrets(job.connection_id, { host: conn.host, port: conn.port, user: conn.username, password });

  const started = Date.now();
  try {
    if (job.job_type === 'vacuum') await vacuumDatabase(job.connection_id, job.database);
    else if (job.job_type === 'analyze') await analyzeDatabase(job.connection_id, job.database);
    else await reindexDatabase(job.connection_id, job.database);
    return { status: 'ok', duration_ms: Date.now() - started, error: null };
  } catch (e) {
    return { status: 'error', duration_ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

const running = new Set<string>();

export async function runMaintenanceJob(
  jobId: string,
  opts: { advance?: boolean } = {}
): Promise<{ status: 'ok' | 'error' | 'skipped'; error: string | null }> {
  const job = getMaintenanceJob(jobId);
  if (!job) throw new Error('Задание не найдено');
  if (running.has(jobId)) throw new Error('Задание уже выполняется');
  running.add(jobId);
  try {
    const startedIso = new Date().toISOString();
    let res: { status: 'ok' | 'error'; duration_ms: number; error: string | null };
    try {
      res = await executeJob(job);
    } catch (e) {
      res = { status: 'error', duration_ms: 0, error: e instanceof Error ? e.message : String(e) };
    }
    const finishedIso = new Date().toISOString();
    logMaintenanceRun({
      job_id: job.id,
      started_at: startedIso,
      finished_at: finishedIso,
      status: res.status,
      duration_ms: res.duration_ms,
      error: res.error,
      detail: `${job.job_type.toUpperCase()} · ${job.database}`,
    });
    if (opts.advance) {
      const next = computeNextRun(job.schedule_type, job.schedule_value, new Date());
      setMaintenanceJobRun(job.id, finishedIso, next.toISOString());
    }
    return { status: res.status, error: res.error };
  } finally {
    running.delete(jobId);
  }
}

async function tick(): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const due = getDueJobs(nowIso);
  for (const job of due) {
    if (running.has(job.id)) continue;
    // пропущенный запуск (сервер был недоступен) при выключенном догоне — пропускаем
    const overdue = job.next_run_at && new Date(job.next_run_at).getTime() < now.getTime() - 60_000;
    if (overdue && !job.catch_up) {
      const next = computeNextRun(job.schedule_type, job.schedule_value, now);
      logMaintenanceRun({
        job_id: job.id,
        started_at: job.next_run_at!,
        finished_at: nowIso,
        status: 'skipped',
        duration_ms: null,
        error: null,
        detail: 'пропущен (сервер был недоступен)',
      });
      setMaintenanceJobRun(job.id, job.last_run_at ?? nowIso, next.toISOString());
      continue;
    }
    // fire-and-forget, чтобы не блокировать тик
    void runMaintenanceJob(job.id, { advance: true }).catch((e) => console.error('[maintenance]', job.id, e));
  }
}

export function startScheduler(): void {
  void tick();
  setInterval(() => void tick(), 30_000);
}
