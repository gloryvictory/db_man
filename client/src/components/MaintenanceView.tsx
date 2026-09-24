import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Play, Trash2, Pencil, Download, RefreshCw, Power, Wand2 } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import { Button, Loader, Tabs, Modal, Field, Input, Select, Info } from './ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import { formatDateRel } from '../lib/format';
import type { MaintenanceJob, MaintenanceRun, MaintenanceStats } from '../types';

const JOB_TYPE_LABEL: Record<string, string> = { vacuum: 'VACUUM', analyze: 'ANALYZE', vacuum_analyze: 'VACUUM ANALYZE', reindex: 'REINDEX' };
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type JobSortKey = 'conn' | 'db' | 'type' | 'schedule' | 'last' | 'next';

function formatSchedule(schedule_type: string, schedule_value: string): string {
  if (schedule_type === 'daily') return `ежедневно в ${schedule_value}`;
  if (schedule_type === 'weekly') {
    const [d, t] = schedule_value.split(' ');
    return `еженедельно ${DAYS[Number(d) - 1] ?? d} в ${t}`;
  }
  return `каждые ${schedule_value} ч`;
}

const WINDOW_START_MIN = 23 * 60; // 23:00
const WINDOW_MINUTES = 540; // 23:00 → 08:00

/** Равномерно распределяет N баз в окне 23:00–08:00 со сдвигом offset (минут). */
function distributeTimes(count: number, offset = 0): string[] {
  const step = count > 1 ? WINDOW_MINUTES / count : 0;
  return Array.from({ length: count }, (_, i) => {
    const total = WINDOW_START_MIN + Math.round(i * step) + offset;
    const mins = total % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

/** Время «ЧЧ:ММ» → минуты от 23:00 (для сравнения порядка внутри ночного окна). */
function toWindowMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m - WINDOW_START_MIN + 1440) % 1440;
}

/** Сдвиг времени по операции: VACUUM → 0, ANALYZE → +30 мин, REINDEX → +60 мин. */
const JOB_OFFSET_MIN: Record<string, number> = {
  vacuum: 0,
  vacuum_analyze: 0,
  analyze: 30,
  reindex: 60,
};

/** Какие типы заданий удалять при создании выбранной операции. */
function deleteTypesFor(jobType: string): string[] {
  if (jobType === 'vacuum_analyze') return ['vacuum', 'analyze'];
  return [jobType];
}

/** Предшествующие операции, после которых должна идти выбранная. */
function precedingTypes(jobType: string): string[] {
  if (jobType === 'analyze') return ['vacuum', 'vacuum_analyze'];
  if (jobType === 'reindex') return ['analyze', 'vacuum_analyze'];
  return [];
}

interface FormState {
  connection_id: string;
  database: string;
  job_type: string;
  schedule_type: string;
  time: string;
  weekday: string;
  hours: string;
  enabled: boolean;
  catch_up: boolean;
}

function formToScheduleValue(f: FormState): string {
  if (f.schedule_type === 'daily') return f.time;
  if (f.schedule_type === 'weekly') return `${f.weekday} ${f.time}`;
  return f.hours;
}

function jobToForm(j: MaintenanceJob): FormState {
  let time = '03:00';
  let weekday = '1';
  let hours = '24';
  if (j.schedule_type === 'daily') time = j.schedule_value;
  else if (j.schedule_type === 'weekly') {
    const [d, t] = j.schedule_value.split(' ');
    weekday = d;
    time = t;
  } else hours = j.schedule_value;
  return {
    connection_id: j.connection_id,
    database: j.database,
    job_type: j.job_type,
    schedule_type: j.schedule_type,
    time,
    weekday,
    hours,
    enabled: j.enabled,
    catch_up: j.catch_up,
  };
}

export default function MaintenanceView() {
  const store = useStore();
  const [tab, setTab] = useState<'jobs' | 'history' | 'stats'>('jobs');
  const [jobs, setJobs] = useState<MaintenanceJob[] | null>(null);
  const [runs, setRuns] = useState<MaintenanceRun[] | null>(null);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MaintenanceJob | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [delTypeOpen, setDelTypeOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobSort, setJobSort] = useState<{ key: JobSortKey; dir: 'asc' | 'desc' } | null>(null);

  const connections = store.connections;

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await api.listMaintenance());
    } catch {
      setJobs([]);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      setRuns((await api.maintenanceRuns({ limit: 200 })).rows);
    } catch {
      setRuns([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.maintenanceStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadRuns();
    loadStats();
  }, [loadJobs, loadRuns, loadStats]);

  async function runNow(job: MaintenanceJob) {
    setRunningId(job.id);
    try {
      const r = await api.runMaintenance(job.id);
      if (r.status === 'ok') toast.success(`${JOB_TYPE_LABEL[job.job_type]} · ${job.database} — выполнено`);
      else toast.error(r.error ?? 'Ошибка выполнения');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setRunningId(null);
      await Promise.all([loadJobs(), loadRuns(), loadStats()]);
    }
  }

  async function toggle(job: MaintenanceJob) {
    try {
      const r = await api.toggleMaintenance(job.id);
      toast.success(r.enabled ? 'Задание включено' : 'Задание выключено');
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async function remove(job: MaintenanceJob) {
    if (!window.confirm('Удалить задание и всю его историю?')) return;
    try {
      await api.deleteMaintenance(job.id);
      toast.success('Задание удалено');
      await Promise.all([loadJobs(), loadRuns(), loadStats()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(job: MaintenanceJob) {
    setEditing(job);
    setFormOpen(true);
  }

  async function submit(form: FormState) {
    const schedule_value = formToScheduleValue(form);
    const payload = {
      connection_id: form.connection_id,
      database: form.database,
      job_type: form.job_type,
      schedule_type: form.schedule_type,
      schedule_value,
      enabled: form.enabled,
      catch_up: form.catch_up,
    };
    try {
      if (editing) {
        await api.updateMaintenance(editing.id, payload);
        toast.success('Задание обновлено');
      } else {
        await api.createMaintenance(payload);
        toast.success('Задание создано');
      }
      setFormOpen(false);
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  async function autoDistribute(connectionId: string, jobType: string): Promise<boolean> {
    try {
      const dbs = await api.databases(connectionId);
      if (!dbs.length) throw new Error('Нет доступных баз данных');
      const offset = JOB_OFFSET_MIN[jobType] ?? 0;
      const times = distributeTimes(dbs.length, offset);

      // проверка порядка: выбранная операция должна идти после предшествующих (для каждой БД)
      const preceding = precedingTypes(jobType);
      if (preceding.length) {
        const others = (jobs ?? []).filter((j) => j.connection_id === connectionId && preceding.includes(j.job_type));
        for (const o of others) {
          const idx = dbs.indexOf(o.database);
          if (idx >= 0 && toWindowMinutes(o.schedule_value) >= toWindowMinutes(times[idx])) {
            throw new Error(
              `Нарушен порядок: ${JOB_TYPE_LABEL[o.job_type]} для «${o.database}» (${o.schedule_value}) должен быть раньше ${JOB_TYPE_LABEL[jobType]} (${times[idx]})`
            );
          }
        }
      }

      // удаляем задания только этой операции (для vacuum_analyze — vacuum + analyze)
      const delTypes = deleteTypesFor(jobType);
      const existing = (jobs ?? []).filter((j) => j.connection_id === connectionId && delTypes.includes(j.job_type));
      for (const j of existing) await api.deleteMaintenance(j.id);

      // создаём новые
      for (let i = 0; i < dbs.length; i++) {
        await api.createMaintenance({
          connection_id: connectionId,
          database: dbs[i],
          job_type: jobType,
          schedule_type: 'daily',
          schedule_value: times[i],
          enabled: true,
          catch_up: false,
        });
      }
      toast.success(`Создано заданий: ${dbs.length}`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
      return false;
    } finally {
      await Promise.all([loadJobs(), loadRuns(), loadStats()]);
    }
  }

  async function deleteByType(connectionId: string, jobType: string): Promise<boolean> {
    try {
      const targets = (jobs ?? []).filter((j) => j.job_type === jobType && (!connectionId || j.connection_id === connectionId));
      if (!targets.length) throw new Error('Нет заданий для удаления');
      for (const j of targets) await api.deleteMaintenance(j.id);
      toast.success(`Удалено заданий: ${targets.length}`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
      return false;
    } finally {
      await Promise.all([loadJobs(), loadRuns(), loadStats()]);
    }
  }

  const connLabel = (id: string) => {
    const c = connections.find((x) => x.id === id);
    return c ? `${c.name} (${c.host}:${c.port})` : id;
  };

  function jobSortValue(j: MaintenanceJob, key: JobSortKey): string {
    switch (key) {
      case 'conn':
        return connLabel(j.connection_id);
      case 'db':
        return j.database;
      case 'type':
        return JOB_TYPE_LABEL[j.job_type] ?? j.job_type;
      case 'schedule':
        return j.schedule_value;
      case 'last':
        return j.last_run_at ?? '';
      case 'next':
        return j.next_run_at ?? '';
    }
  }

  function toggleSort(key: JobSortKey) {
    setJobSort((s) => {
      if (s?.key === key) return s.dir === 'asc' ? { key, dir: 'desc' } : null;
      return { key, dir: 'asc' };
    });
  }

  const sortArrow = (key: JobSortKey) => (jobSort?.key === key ? (jobSort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    let list = jobs ?? [];
    if (q) {
      list = list.filter((j) =>
        [j.database, JOB_TYPE_LABEL[j.job_type] ?? j.job_type, connLabel(j.connection_id), formatSchedule(j.schedule_type, j.schedule_value)]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (jobSort) {
      const { key, dir } = jobSort;
      list = [...list].sort((a, b) => {
        const va = jobSortValue(a, key);
        const vb = jobSortValue(b, key);
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, jobSearch, jobSort, connections]);

  const statsHeader = ['База данных', 'Операция', 'Запусков', 'Успешно', 'Ошибок', 'Последний запуск', 'Средняя длительность, мс'];
  const statsRows = (stats?.byJob ?? []).map((s) => [
    s.database,
    JOB_TYPE_LABEL[s.job_type] ?? s.job_type,
    s.runs,
    s.ok,
    s.error,
    s.last_run ? new Date(s.last_run).toLocaleString('ru-RU') : '',
    s.avg_duration_ms == null ? '' : Math.round(s.avg_duration_ms),
  ]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Обслуживание</h1>
        <div className="ml-4">
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as 'jobs' | 'history' | 'stats')}
            items={[
              { value: 'jobs', label: 'Задания' },
              { value: 'history', label: 'История' },
              { value: 'stats', label: 'Отчёты' },
            ]}
          />
        </div>
        <div className="flex-1" />
        {tab === 'jobs' && (
          <>
            <Button variant="subtle" onClick={() => setAutoOpen(true)} disabled={!connections.length}>
              <Wand2 size={14} />
              Распределить автоматически
            </Button>
            <Button variant="subtle" onClick={() => setDelTypeOpen(true)} disabled={!jobs?.length}>
              <Trash2 size={14} style={{ color: 'var(--red)' }} />
              Удалить по типу
            </Button>
            <Button variant="primary" onClick={openCreate} disabled={!connections.length}>
              <Plus size={14} />
              Добавить задание
            </Button>
          </>
        )}
      </div>

      {!connections.length ? (
        <div className="text-sm text-[var(--faint)]">Сначала добавьте подключение.</div>
      ) : tab === 'jobs' ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Input
              className="max-w-[320px]"
              placeholder="Поиск по БД, операции, подключению…"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
            />
            <span className="font-mono text-[11px] text-[var(--faint)]">
              {filteredJobs.length}
              {jobSearch ? ` / ${jobs?.length ?? 0}` : ''}
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          {jobs === null ? (
            <div className="grid place-items-center py-16">
              <Loader />
            </div>
          ) : (
            <table className="w-full border-collapse font-mono text-[12px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left">
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('conn')}>
                    Подключение{sortArrow('conn')}
                  </th>
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('db')}>
                    База{sortArrow('db')}
                  </th>
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('type')}>
                    Операция{sortArrow('type')}
                  </th>
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('schedule')}>
                    Расписание{sortArrow('schedule')}
                  </th>
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('last')}>
                    Последний запуск{sortArrow('last')}
                  </th>
                  <th className="cursor-pointer select-none border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleSort('next')}>
                    Следующий{sortArrow('next')}
                  </th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[var(--null)]">
                      {jobs?.length ? 'Ничего не найдено' : 'Заданий нет'}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((j) => (
                    <tr key={j.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface-hover)] ${j.enabled ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-1.5 text-[var(--text)]">{connLabel(j.connection_id)}</td>
                      <td className="px-3 py-1.5 text-[var(--amber)]">{j.database}</td>
                      <td className="px-3 py-1.5 text-[var(--text)]">{JOB_TYPE_LABEL[j.job_type]}</td>
                      <td className="px-3 py-1.5 text-[var(--muted)]">{formatSchedule(j.schedule_type, j.schedule_value)}</td>
                      <td className="px-3 py-1.5 text-[var(--faint)]">{j.last_run_at ? formatDateRel(j.last_run_at) : '—'}</td>
                      <td className="px-3 py-1.5 text-[var(--faint)]">{j.next_run_at ? formatDateRel(j.next_run_at) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">
                        <Button size="xs" variant="subtle" title="Запустить сейчас" disabled={runningId === j.id} onClick={() => runNow(j)}>
                          <Play size={12} />
                        </Button>
                        <Button size="xs" variant="subtle" title={j.enabled ? 'Выключить' : 'Включить'} onClick={() => toggle(j)}>
                          <Power size={12} style={{ color: j.enabled ? 'var(--accent)' : 'var(--faint)' }} />
                        </Button>
                        <Button size="xs" variant="subtle" title="Править" onClick={() => openEdit(j)}>
                          <Pencil size={12} />
                        </Button>
                        <Button size="xs" variant="subtle" title="Удалить" onClick={() => remove(j)} style={{ color: 'var(--red)' }}>
                          <Trash2 size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          </div>
        </div>
      ) : tab === 'history' ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Button size="xs" variant="subtle" onClick={loadRuns}>
              <RefreshCw size={12} />
              Обновить
            </Button>
            <div className="flex-1" />
            <Button size="xs" variant="subtle" onClick={() => exportToCsv('maintenance_runs', ['Время', 'Задание', 'Статус', 'Длительность, мс', 'Ошибка'], (runs ?? []).map((r) => [r.started_at, r.detail ?? '', r.status, r.duration_ms ?? '', r.error ?? '']))}>
              <Download size={12} />
              CSV
            </Button>
            <Button size="xs" variant="subtle" onClick={() => exportToExcel('maintenance_runs', ['Время', 'Задание', 'Статус', 'Длительность, мс', 'Ошибка'], (runs ?? []).map((r) => [r.started_at, r.detail ?? '', r.status, r.duration_ms ?? '', r.error ?? '']))}>
              <Download size={12} />
              Excel
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            {runs === null ? (
              <div className="grid place-items-center py-16">
                <Loader />
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-[var(--surface)] text-left">
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Время</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Задание</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Статус</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Длительность</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--null)]">
                        Запусков ещё не было
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                        <td className="whitespace-nowrap px-3 py-1.5 text-[var(--null)]">{r.started_at}</td>
                        <td className="px-3 py-1.5 text-[var(--text)]">{r.detail ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {r.status === 'ok' ? (
                            <span className="text-[var(--accent)]">ok</span>
                          ) : r.status === 'skipped' ? (
                            <span className="text-[var(--amber)]">пропущен</span>
                          ) : (
                            <span className="text-[var(--red)]">ошибка</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right text-[var(--text)]">
                          {r.duration_ms != null ? `${r.duration_ms.toLocaleString('ru-RU')} мс` : '—'}
                        </td>
                        <td className="max-w-[360px] truncate px-3 py-1.5 text-[var(--red)]" title={r.error ?? undefined}>
                          {r.error ?? <span className="text-[var(--null)]">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Запусков" value={(stats?.total_runs ?? 0).toLocaleString('ru-RU')} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Успешно" value={(stats?.ok ?? 0).toLocaleString('ru-RU')} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Ошибок" value={(stats?.error ?? 0).toLocaleString('ru-RU')} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Средняя длительность" value={stats?.avg_duration_ms != null ? `${Math.round(stats.avg_duration_ms).toLocaleString('ru-RU')} мс` : '—'} mono />
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">По заданиям</h2>
            <div className="flex-1" />
            <Button size="xs" variant="subtle" onClick={() => exportToCsv('maintenance_stats', statsHeader, statsRows)}>
              <Download size={12} />
              CSV
            </Button>
            <Button size="xs" variant="subtle" onClick={() => exportToExcel('maintenance_stats', statsHeader, statsRows)}>
              <Download size={12} />
              Excel
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full border-collapse font-mono text-[12px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left">
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">База данных</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Операция</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Запусков</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Успешно</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Ошибок</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Последний запуск</th>
                  <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Средняя длительность</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.byJob ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[var(--null)]">
                      Данных ещё нет
                    </td>
                  </tr>
                ) : (
                  (stats?.byJob ?? []).map((s) => (
                    <tr key={s.job_id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                      <td className="px-3 py-1.5 text-[var(--amber)]">{s.database}</td>
                      <td className="px-3 py-1.5 text-[var(--text)]">{JOB_TYPE_LABEL[s.job_type] ?? s.job_type}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text)]">{s.runs}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--accent)]">{s.ok}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: s.error ? 'var(--red)' : 'var(--faint)' }}>{s.error || '—'}</td>
                      <td className="px-3 py-1.5 text-[var(--faint)]">{s.last_run ? formatDateRel(s.last_run) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text)]">
                        {s.avg_duration_ms != null ? `${Math.round(s.avg_duration_ms).toLocaleString('ru-RU')} мс` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <JobFormModal
          connections={connections}
          initial={editing ? jobToForm(editing) : null}
          title={editing ? 'Изменить задание' : 'Новое задание'}
          onClose={() => setFormOpen(false)}
          onSubmit={submit}
        />
      )}

      {autoOpen && (
        <AutoDistributeModal
          connections={connections}
          onClose={() => setAutoOpen(false)}
          onSubmit={autoDistribute}
        />
      )}

      {delTypeOpen && (
        <DeleteByTypeModal
          connections={connections}
          onClose={() => setDelTypeOpen(false)}
          onSubmit={deleteByType}
        />
      )}
    </div>
  );
}

function JobFormModal({
  connections,
  initial,
  title,
  onClose,
  onSubmit,
}: {
  connections: { id: string; name: string; host: string; port: number; username: string }[];
  initial: FormState | null;
  title: string;
  onClose: () => void;
  onSubmit: (f: FormState) => Promise<void>;
}) {
  const [f, setF] = useState<FormState>(
    initial ?? {
      connection_id: connections[0]?.id ?? '',
      database: '',
      job_type: 'vacuum',
      schedule_type: 'daily',
      time: '03:00',
      weekday: '1',
      hours: '24',
      enabled: true,
      catch_up: true,
    }
  );
  const [busy, setBusy] = useState(false);
  const [databases, setDatabases] = useState<string[] | null>(null);

  useEffect(() => {
    if (!f.connection_id) {
      setDatabases(null);
      return;
    }
    let on = true;
    setDatabases(null);
    api
      .databases(f.connection_id)
      .then((d) => on && setDatabases(d))
      .catch(() => on && setDatabases([]));
    return () => {
      on = false;
    };
  }, [f.connection_id]);

  const connOptions = connections.map((c) => ({ value: c.id, label: `${c.host}@${c.username}` }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(f);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title} width={460}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Подключение">
          <Select value={f.connection_id} onChange={(v) => v && setF((s) => ({ ...s, connection_id: v }))} options={connOptions} width={380} placeholder="Подключение" searchable />
        </Field>
        <Field
          label="База данных"
          description={databases && databases.length === 0 ? 'Подключение не установлено — введите имя вручную' : 'База, к которой применить операцию'}
        >
          {databases && databases.length > 0 ? (
            <Select
              value={f.database || null}
              onChange={(v) => v && setF((s) => ({ ...s, database: v }))}
              options={databases.map((d) => ({ value: d, label: d }))}
              width={380}
              placeholder="База данных"
              searchable
            />
          ) : (
            <Input value={f.database} onChange={(e) => setF((s) => ({ ...s, database: e.target.value }))} placeholder="neo_klass" />
          )}
        </Field>
        <Field label="Операция">
          <Select
            value={f.job_type}
            onChange={(v) => v && setF((s) => ({ ...s, job_type: v }))}
            options={[
              { value: 'vacuum', label: 'VACUUM' },
              { value: 'analyze', label: 'ANALYZE' },
              { value: 'vacuum_analyze', label: 'VACUUM ANALYZE' },
              { value: 'reindex', label: 'REINDEX' },
            ]}
            width={380}
          />
        </Field>
        <Field label="Расписание">
          <Select
            value={f.schedule_type}
            onChange={(v) => v && setF((s) => ({ ...s, schedule_type: v }))}
            options={[
              { value: 'daily', label: 'Ежедневно' },
              { value: 'weekly', label: 'Еженедельно' },
              { value: 'hours', label: 'Каждые N часов' },
            ]}
            width={380}
          />
        </Field>

        {f.schedule_type === 'daily' && (
          <Field label="Время запуска">
            <Input type="time" value={f.time} onChange={(e) => setF((s) => ({ ...s, time: e.target.value }))} />
          </Field>
        )}
        {f.schedule_type === 'weekly' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="День недели">
              <Select value={f.weekday} onChange={(v) => v && setF((s) => ({ ...s, weekday: v }))} options={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))} width={180} />
            </Field>
            <Field label="Время запуска">
              <Input type="time" value={f.time} onChange={(e) => setF((s) => ({ ...s, time: e.target.value }))} />
            </Field>
          </div>
        )}
        {f.schedule_type === 'hours' && (
          <Field label="Интервал, часов">
            <Input type="number" min={1} value={f.hours} onChange={(e) => setF((s) => ({ ...s, hours: e.target.value }))} />
          </Field>
        )}

        <div className="flex items-center gap-4 pt-1 text-[13px]">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={f.enabled} onChange={(e) => setF((s) => ({ ...s, enabled: e.target.checked }))} />
            Включено
          </label>
          <label className="flex cursor-pointer items-center gap-2" title="Выполнять пропущенные запуски, если сервер был недоступен">
            <input type="checkbox" checked={f.catch_up} onChange={(e) => setF((s) => ({ ...s, catch_up: e.target.checked }))} />
            Догон пропущенных
          </label>
        </div>

        <div className="text-[11px] text-[var(--faint)]">
          Для автозапуска у подключения должен быть сохранён пароль.
        </div>

        <Button variant="primary" type="submit" disabled={busy || !f.connection_id || !f.database.trim()}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </form>
    </Modal>
  );
}

function AutoDistributeModal({
  connections,
  onClose,
  onSubmit,
}: {
  connections: { id: string; name: string; host: string; port: number; username: string }[];
  onClose: () => void;
  onSubmit: (connectionId: string, jobType: string) => Promise<boolean>;
}) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? '');
  const [jobType, setJobType] = useState('vacuum_analyze');
  const [databases, setDatabases] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connectionId) {
      setDatabases(null);
      return;
    }
    let on = true;
    setDatabases(null);
    api
      .databases(connectionId)
      .then((d) => on && setDatabases(d))
      .catch(() => on && setDatabases([]));
    return () => {
      on = false;
    };
  }, [connectionId]);

  const connOptions = connections.map((c) => ({ value: c.id, label: `${c.host}@${c.username}` }));
  const offset = JOB_OFFSET_MIN[jobType] ?? 0;
  const times = databases ? distributeTimes(databases.length, offset) : [];

  async function confirm() {
    if (!connectionId) return;
    setBusy(true);
    try {
      const ok = await onSubmit(connectionId, jobType);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Распределить автоматически" width={520}>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[var(--red)] p-3 text-[13px] text-[var(--red)]">
          {jobType === 'vacuum_analyze'
            ? 'Внимание: задания VACUUM и ANALYZE для выбранного подключения будут удалены и созданы заново.'
            : `Внимание: задания ${JOB_TYPE_LABEL[jobType]} для выбранного подключения будут удалены и созданы заново.`}{' '}
          Задания других операций сохраняются.
        </div>

        <Field label="Подключение">
          <Select
            value={connectionId}
            onChange={(v) => v && setConnectionId(v)}
            options={connOptions}
            width={440}
            placeholder="Подключение"
            searchable
          />
        </Field>

        <Field label="Операция">
          <Select
            value={jobType}
            onChange={(v) => v && setJobType(v)}
            options={[
              { value: 'vacuum', label: 'VACUUM' },
              { value: 'analyze', label: 'ANALYZE' },
              { value: 'vacuum_analyze', label: 'VACUUM ANALYZE' },
              { value: 'reindex', label: 'REINDEX' },
            ]}
            width={440}
          />
        </Field>

        <Field label="Период" description="Все базы распределяются равномерно">
          <div className="text-[13px] text-[var(--text)]">ежедневно с 23:00 до 08:00</div>
          {offset > 0 && (
            <div className="text-[11px] text-[var(--faint)]">
              Сдвиг +{offset} мин — {jobType === 'analyze' ? 'после VACUUM' : 'после ANALYZE'} для каждой БД.
            </div>
          )}
        </Field>

        {databases && databases.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Распределение ({databases.length} БД)
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse font-mono text-[12px]">
                <tbody>
                  {databases.map((d, i) => (
                    <tr key={d} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-1 text-[var(--amber)]">{d}</td>
                      <td className="px-3 py-1 text-right text-[var(--text)]">{times[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[11px] text-[var(--faint)]">
          Для автозапуска у подключения должен быть сохранён пароль. Пропущенные запуски (сервер был недоступен ночью) не выполняются днём.
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant="primary" onClick={confirm} disabled={busy || !connectionId}>
            {busy ? 'Создание…' : 'Удалить и создать'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteByTypeModal({
  connections,
  onClose,
  onSubmit,
}: {
  connections: { id: string; name: string; host: string; port: number; username: string }[];
  onClose: () => void;
  onSubmit: (connectionId: string, jobType: string) => Promise<boolean>;
}) {
  const [jobType, setJobType] = useState('vacuum');
  const [connectionId, setConnectionId] = useState(''); // '' = все подключения
  const [busy, setBusy] = useState(false);

  const connOptions = [
    { value: '', label: 'Все подключения' },
    ...connections.map((c) => ({ value: c.id, label: `${c.host}@${c.username}` })),
  ];

  async function confirm() {
    setBusy(true);
    try {
      const ok = await onSubmit(connectionId, jobType);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Удалить задания по типу" width={460}>
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[var(--red)] p-3 text-[13px] text-[var(--red)]">
          Внимание: будут удалены все задания выбранной операции (вместе с историей).
        </div>

        <Field label="Операция">
          <Select
            value={jobType}
            onChange={(v) => v && setJobType(v)}
            options={[
              { value: 'vacuum', label: 'VACUUM' },
              { value: 'analyze', label: 'ANALYZE' },
              { value: 'vacuum_analyze', label: 'VACUUM ANALYZE' },
              { value: 'reindex', label: 'REINDEX' },
            ]}
            width={400}
          />
        </Field>

        <Field label="Подключение" description="«Все подключения» — удалить везде">
          <Select value={connectionId} onChange={(v) => setConnectionId(v ?? '')} options={connOptions} width={400} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant="primary" onClick={confirm} disabled={busy} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>
            {busy ? 'Удаление…' : 'Удалить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
