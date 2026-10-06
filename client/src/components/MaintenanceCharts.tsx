import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Legend,
  PieChart,
  Pie,
  Treemap,
} from 'recharts';
import { api } from '../api';
import { useStore } from '../store';
import { Loader, Select } from './ui';
import { formatBytes } from '../lib/format';
import type { ConnectionAnalysisRow, DatabaseTableRow, MaintenanceRun, ConnectionInfo } from '../types';

const tooltipStyle = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text)',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
};

const BLOAT_THRESHOLD = 20; // % — порог «тревожного» bloat

const PIE_COLORS = [
  'var(--accent)',
  '#4f8ef7',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
];

const ROW_BUCKETS = [
  { label: '0', min: 0, max: 0 },
  { label: '1–100', min: 1, max: 100 },
  { label: '101–1К', min: 101, max: 1000 },
  { label: '1К–10К', min: 1001, max: 10000 },
  { label: '10К–100К', min: 10001, max: 100000 },
  { label: '100К–1М', min: 100001, max: 1000000 },
  { label: '1М+', min: 1000001, max: Infinity },
];

function bloatColor(ratio: number): string {
  if (ratio * 100 > BLOAT_THRESHOLD) return 'var(--red)';
  if (ratio * 100 > 5) return 'var(--amber)';
  return 'var(--muted)';
}

interface BloatPoint {
  name: string;
  ratio: number;
  value: number;
}

function bucketRuns(runs: MaintenanceRun[]) {
  if (!runs.length) return [];
  const times = runs.map((r) => new Date(r.started_at).getTime());
  const span = Math.max(...times) - Math.min(...times);
  const byHour = span < 48 * 3600 * 1000;
  const map = new Map<string, { ts: number; ok: number; error: number; skipped: number }>();
  for (const r of runs) {
    const d = new Date(r.started_at);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const label = byHour ? `${dd}.${mm} ${String(d.getHours()).padStart(2, '0')}:00` : `${dd}.${mm}`;
    const e = map.get(label) ?? { ts: d.getTime(), ok: 0, error: 0, skipped: 0 };
    if (r.status === 'ok') e.ok++;
    else if (r.status === 'error') e.error++;
    else e.skipped++;
    map.set(label, e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([time, v]) => ({ time, ok: v.ok, error: v.error, skipped: v.skipped }));
}

export default function MaintenanceCharts() {
  const store = useStore();
  const connections = store.connections;

  const [connId, setConnId] = useState<string>(store.activeConnId ?? '');
  const [db, setDb] = useState<string>('');
  const [dbs, setDbs] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<ConnectionAnalysisRow[] | null>(null);
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [tables, setTables] = useState<DatabaseTableRow[] | null>(null);
  const [runs, setRuns] = useState<MaintenanceRun[] | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  useEffect(() => {
    if (!connId && connections.length) setConnId(connections[0].id);
  }, [connId, connections]);

  useEffect(() => {
    api
      .maintenanceRuns({ limit: 200 })
      .then((r) => setRuns(r.rows))
      .catch(() => setRuns([]));
  }, []);

  useEffect(() => {
    if (!connId) {
      setAnalysis(null);
      setInfo(null);
      setDbs([]);
      return;
    }
    let on = true;
    setAnalysis(null);
    setInfo(null);
    api
      .connectionAnalysis(connId)
      .then((a) => on && setAnalysis(a))
      .catch(() => on && setAnalysis([]));
    api
      .connectionInfo(connId)
      .then((i) => on && setInfo(i))
      .catch(() => on && setInfo(null));
    api
      .databases(connId)
      .then((d) => {
        if (!on) return;
        const names = d.map((x) => x.name);
        setDbs(names);
        setDb((cur) => (names.includes(cur) ? cur : names[0] ?? ''));
      })
      .catch(() => on && setDbs([]));
    return () => {
      on = false;
    };
  }, [connId]);

  useEffect(() => {
    if (!connId || !db) {
      setTables(null);
      return;
    }
    let on = true;
    setLoadingTables(true);
    api
      .databaseAnalysis(connId, db)
      .then((t) => on && setTables(t))
      .catch(() => on && setTables([]))
      .finally(() => on && setLoadingTables(false));
    return () => {
      on = false;
    };
  }, [connId, db]);

  const dbBloat: BloatPoint[] = useMemo(
    () =>
      (analysis ?? [])
        .map((r) => ({ name: r.database, ratio: r.dead_ratio, value: +(r.dead_ratio * 100).toFixed(1) }))
        .sort((a, b) => b.ratio - a.ratio),
    [analysis],
  );

  const tableBloat: BloatPoint[] = useMemo(
    () =>
      (tables ?? [])
        .filter((t) => t.dead_ratio > 0)
        .map((t) => ({ name: `${t.schema}.${t.name}`, ratio: t.dead_ratio, value: +(t.dead_ratio * 100).toFixed(1) }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 20),
    [tables],
  );

  const runBuckets = useMemo(() => bucketRuns(runs ?? []), [runs]);

  const dbSizes = useMemo(
    () =>
      (info?.databases ?? [])
        .filter((d) => d.size_bytes > 0)
        .map((d, i) => ({ name: d.name, value: d.size_bytes, fill: PIE_COLORS[i % PIE_COLORS.length] }))
        .sort((a, b) => b.value - a.value),
    [info],
  );

  const tableSizes = useMemo(
    () =>
      (tables ?? [])
        .filter((t) => t.total_size > 0)
        .map((t) => ({ name: `${t.schema}.${t.name}`, size: t.total_size }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 20),
    [tables],
  );

  const rowsHistogram = useMemo(
    () =>
      ROW_BUCKETS.map((b) => ({
        range: b.label,
        count: (tables ?? []).filter((t) => t.kind !== 'view' && t.row_estimate >= b.min && t.row_estimate <= b.max).length,
      })),
    [tables],
  );

  const connOptions = connections.map((c) => ({ value: c.id, label: `${c.host}@${c.username}` }));
  const dbOptions = dbs.map((d) => ({ value: d, label: d }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={connId || null}
          onChange={(v) => {
            setConnId(v ?? '');
            setDb('');
          }}
          options={connOptions}
          width={260}
          placeholder="Подключение"
          searchable
        />
        <Select
          value={db || null}
          onChange={(v) => setDb(v ?? '')}
          options={dbOptions}
          width={240}
          placeholder="База данных"
          searchable
        />
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Размер по БД</h2>
        {info === null ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : dbSizes.length === 0 ? (
          <div className="py-6 text-[12px] text-[var(--faint)]">Нет данных о размере.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dbSizes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} stroke="var(--bg-panel)" strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [formatBytes(Number(v)), String(n)]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Bloat % по БД</h2>
        {analysis === null ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : dbBloat.length === 0 ? (
          <div className="py-6 text-[12px] text-[var(--faint)]">Нет данных о bloat.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dbBloat} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" unit="%" stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} stroke="var(--faint)" tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'bloat']} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {dbBloat.map((d, i) => (
                    <Cell key={i} fill={bloatColor(d.ratio)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Размер по таблицам (top 20 · {db || '—'})
        </h2>
        {loadingTables ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : tableSizes.length === 0 ? (
          <div className="py-6 text-[12px] text-[var(--faint)]">Нет таблиц с размером.</div>
        ) : (
          <div className="h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={tableSizes} dataKey="size" nameKey="name" stroke="var(--bg-panel)" colorPanel={['var(--accent)'] as any}>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatBytes(Number(v))} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Bloat по таблицам (top 20 · {db || '—'})
        </h2>
        {loadingTables ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : tableBloat.length === 0 ? (
          <div className="py-6 text-[12px] text-[var(--faint)]">Нет таблиц с bloat.</div>
        ) : (
          <div className="h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableBloat} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" unit="%" stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={190} stroke="var(--faint)" tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'bloat']} />
                <ReferenceLine
                  x={BLOAT_THRESHOLD}
                  stroke="var(--red)"
                  strokeDasharray="4 4"
                  label={{ value: `порог ${BLOAT_THRESHOLD}%`, fill: 'var(--red)', fontSize: 11, position: 'top' }}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {tableBloat.map((d, i) => (
                    <Cell key={i} fill={bloatColor(d.ratio)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Распределение таблиц по числу строк · {db || '—'}
        </h2>
        {loadingTables ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rowsHistogram} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis allowDecimals={false} stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={34} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('ru-RU'), 'таблиц']} />
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Прогоны по времени</h2>
        {runs === null ? (
          <div className="grid place-items-center py-10">
            <Loader />
          </div>
        ) : runBuckets.length === 0 ? (
          <div className="py-6 text-[12px] text-[var(--faint)]">Прогонов ещё не было.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={runBuckets} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis allowDecimals={false} stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11 }} width={34} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ok" name="успешно" stackId="s" fill="var(--accent)" />
                <Bar dataKey="error" name="ошибка" stackId="s" fill="var(--red)" />
                <Bar dataKey="skipped" name="пропущено" stackId="s" fill="var(--amber)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
