import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import { Loader, Button } from './ui';
import type { SlowQueriesResult } from '../types';

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} мкс`;
  if (ms < 1000) return `${ms.toFixed(1)} мс`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} с`;
  return `${(ms / 60000).toFixed(2)} мин`;
}

export default function SlowQueriesView({ id, db }: { id: string; db: string }) {
  const [data, setData] = useState<SlowQueriesResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.slowQueries(id, db));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, db]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--muted)]">
          Топ запросов по суммарному времени выполнения (<span className="font-mono">pg_stat_statements</span>)
        </span>
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={load} disabled={loading}>
          <RefreshCw size={12} />
          Обновить
        </Button>
      </div>

      {data && !data.available ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-center text-[13px] leading-relaxed text-[var(--muted)]">
          Расширение <span className="font-mono">pg_stat_statements</span> не установлено.
          <br />
          Включите его командой{' '}
          <span className="font-mono">CREATE EXTENSION pg_stat_statements;</span>
          <br />
          <span className="text-[11px] text-[var(--faint)]">
            (может потребоваться shared_preload_libraries = 'pg_stat_statements' в postgresql.conf и перезапуск)
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-[var(--surface)] text-left">
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Запрос</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Вызовы</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Всего</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Среднее</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Строк</th>
              </tr>
            </thead>
            <tbody>
              {(data?.queries ?? []).map((q, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="max-w-[420px] truncate px-3 py-1.5 text-[var(--text)]" title={q.query}>
                    {q.query}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{q.calls.toLocaleString('ru-RU')}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatMs(q.total_time)}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatMs(q.mean_time)}</td>
                  <td className="px-3 py-1.5 text-right text-[var(--text)]">{q.rows.toLocaleString('ru-RU')}</td>
                </tr>
              ))}
              {(data?.queries ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-[var(--null)]">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
