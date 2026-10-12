import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import { Button, Loader, Select, Input } from './ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import { formatBytes } from '../lib/format';
import type { DbSnapshot } from '../types';

export default function SnapshotsReport() {
  const store = useStore();
  const connections = store.connections;
  const [connId, setConnId] = useState<string>(store.activeConnId ?? '');
  const [snapshots, setSnapshots] = useState<DbSnapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!connId && connections.length) setConnId(connections[0].id);
  }, [connId, connections]);

  async function load() {
    if (!connId) return;
    setLoading(true);
    try {
      const r = await api.dbSnapshots(connId, 5000, 0);
      setSnapshots(r.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить снимки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId]);

  const rows = useMemo(() => {
    const list = [...(snapshots ?? [])].sort((a, b) =>
      a.taken_at < b.taken_at ? 1 : a.taken_at > b.taken_at ? -1 : a.database.localeCompare(b.database),
    );
    const q = search.trim().toLowerCase();
    return q ? list.filter((s) => s.database.toLowerCase().includes(q) || s.taken_at.includes(q)) : list;
  }, [snapshots, search]);

  const connOptions = connections.map((c) => ({ value: c.id, label: `${c.host}@${c.username}` }));

  function exportRows(format: 'xlsx' | 'csv') {
    const header = ['Время', 'База', 'Размер, байт', 'Таблиц', 'Строк (оценка)', 'Мёртвых кортежей', 'Bloat %'];
    const data = rows.map((s) => [
      s.taken_at,
      s.database,
      s.size_bytes,
      s.table_count,
      s.row_estimate,
      s.dead_tuples,
      (s.dead_ratio * 100).toFixed(1),
    ]);
    if (format === 'xlsx') exportToExcel('server_stats', header, data);
    else exportToCsv('server_stats', header, data);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={connId || null} onChange={(v) => setConnId(v ?? '')} options={connOptions} width={260} placeholder="Подключение" searchable />
        <Input className="max-w-[260px]" placeholder="Поиск по БД или времени…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button size="xs" variant="subtle" onClick={load}>
          <RefreshCw size={12} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-[var(--faint)]">{snapshots ? rows.length : ''}</span>
        <Button size="xs" variant="subtle" onClick={() => exportRows('csv')}>
          <Download size={12} />
          CSV
        </Button>
        <Button size="xs" variant="subtle" onClick={() => exportRows('xlsx')}>
          <Download size={12} />
          Excel
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        {loading && snapshots === null ? (
          <div className="grid place-items-center py-16">
            <Loader />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--faint)]">
            {snapshots && snapshots.length === 0
              ? 'Снимков ещё нет. Добавьте задание «СБОР СТАТИСТИКИ» в заданиях обслуживания.'
              : 'Ничего не найдено.'}
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-[var(--surface)] text-left">
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Время</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">База</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Размер</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Таблиц</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Строк</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Мёртвых кортежей</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Bloat %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]">
                  <td className="whitespace-nowrap px-3 py-1.5 text-[var(--null)]">{s.taken_at}</td>
                  <td className="px-3 py-1.5 text-[var(--text)]">{s.database}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(s.size_bytes)}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{s.table_count.toLocaleString('ru-RU')}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{s.row_estimate.toLocaleString('ru-RU')}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{s.dead_tuples.toLocaleString('ru-RU')}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: s.dead_ratio > 0.2 ? 'var(--red)' : s.dead_ratio > 0 ? 'var(--amber)' : 'var(--faint)' }}>
                    {s.dead_ratio > 0 ? `${(s.dead_ratio * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
