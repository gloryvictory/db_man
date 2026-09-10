import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '../store';
import { api } from '../api';
import { Select, Loader, Info, Tabs } from '../components/ui';
import { formatBytes } from '../lib/format';
import type { OverviewResult } from '../types';

const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 8,
};

export default function Overview() {
  const store = useStore();
  const [dbs, setDbs] = useState<string[]>([]);
  const [db, setDb] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'size' | 'count'>('size');

  useEffect(() => {
    if (!store.connected || !store.activeConnId) return;
    api.databases(store.activeConnId).then((list) => {
      setDbs(list);
      if (list.length && !db) setDb(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.connected, store.activeConnId]);

  useEffect(() => {
    if (!db || !store.activeConnId) return;
    setLoading(true);
    api
      .overview(store.activeConnId, db)
      .then((r) => {
        setData(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db, store.activeConnId]);

  if (!store.connected) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-sm text-[var(--faint)]">Подключитесь к базе данных, чтобы увидеть обзор.</div>
      </div>
    );
  }

  const biggest = (data?.biggest ?? []).map((t) => ({ name: `${t.schema}.${t.name}`, value: t.total_size }));
  const byRows = (data?.byRows ?? []).map((t) => ({ name: `${t.schema}.${t.name}`, value: t.rows }));
  const bloated = (data?.bloated ?? []).map((t) => ({ name: `${t.schema}.${t.name}`, value: t.dead_tup }));
  const isSize = mode === 'size';

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Обзор</h1>
        <Select
          width={200}
          value={db}
          onChange={setDb}
          options={dbs.map((d) => ({ value: d, label: d }))}
          placeholder="База данных"
          searchable
        />
        <div className="ml-auto">
          <Tabs
            value={mode}
            onChange={(v) => setMode(v as 'size' | 'count')}
            items={[
              { value: 'size', label: 'По размеру' },
              { value: 'count', label: 'По количеству' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid h-[420px] place-items-center">
          <Loader />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Итоги */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Мёртвых кортежей" value={(data?.totals.dead_tuples ?? 0).toLocaleString('ru-RU')} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Неиспользуемых индексов" value={(data?.totals.unused_index_count ?? 0).toLocaleString('ru-RU')} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Занято неисп. индексами" value={formatBytes(data?.totals.unused_index_bytes ?? 0)} mono />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <Info label="Дублирующихся индексов" value={(data?.totals.duplicate_index_count ?? 0).toLocaleString('ru-RU')} mono />
            </div>
          </div>

          {/* Крупнейшие / по количеству */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {isSize ? 'Крупнейшие таблицы' : 'Таблицы по количеству строк'}
            </h2>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={isSize ? biggest : byRows} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--faint)"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    tickFormatter={isSize ? (v) => formatBytes(Number(v)) : (v) => Number(v).toLocaleString('ru-RU')}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    stroke="var(--faint)"
                    tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={
                      isSize
                        ? (v) => [formatBytes(Number(v)), 'размер']
                        : (v) => [Number(v).toLocaleString('ru-RU'), 'строк']
                    }
                  />
                  <Bar dataKey="value" fill="var(--accent)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Распухание */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Распухание (мёртвые кортежи)
            </h2>
            {bloated.length === 0 ? (
              <div className="text-[12px] text-[var(--null)]">Мёртвых кортежей нет.</div>
            ) : (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bloated} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--faint)" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={190}
                      stroke="var(--faint)"
                      tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString('ru-RU'), 'мёртвых кортежей']} />
                    <Bar dataKey="value" fill="var(--red)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Неиспользуемые индексы */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Неиспользуемые индексы</h2>
            {(data?.unused_indexes ?? []).length === 0 ? (
              <div className="text-[12px] text-[var(--null)]">Неиспользуемых индексов нет.</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="bg-[var(--surface)] text-left">
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Таблица</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Индексов</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Занято</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Дубл.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.unused_indexes ?? []).map((t) => (
                      <tr key={`${t.schema}.${t.name}`} className="border-b border-[var(--border)]">
                        <td className="px-3 py-1.5 text-[var(--text)]">
                          {t.schema}.{t.name}
                        </td>
                        <td className="px-3 py-1.5 text-right text-[var(--amber)]">{t.unused_index_count}</td>
                        <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(t.unused_index_bytes)}</td>
                        <td className="px-3 py-1.5 text-right text-[var(--red)]">{t.duplicate_index_count || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
