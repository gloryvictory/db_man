import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Sparkles, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Tabs, Info } from './ui';
import AnalysisTable from './AnalysisTable';
import { formatDateRel, formatBytes } from '../lib/format';
import type { DatabaseInfo, DatabaseStats, DatabaseTableRow } from '../types';

export default function DatabaseView() {
  const store = useStore();
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [analysisRows, setAnalysisRows] = useState<DatabaseTableRow[]>([]);
  const [view, setView] = useState<'info' | 'service' | 'analysis'>('info');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const id = store.activeConnId;
  const db = store.selectedDb;

  const load = useCallback(async () => {
    if (!id || !db) return;
    setLoading(true);
    try {
      const [i, s, a] = await Promise.all([
        api.databaseInfo(id, db),
        api.databaseStats(id, db),
        api.databaseAnalysis(id, db),
      ]);
      setInfo(i);
      setStats(s);
      setAnalysisRows(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, db]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      toast.success('Готово');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  if (!id || !db) return null;

  const cacheHits =
    stats && stats.blks_hit + stats.blks_read > 0
      ? ((stats.blks_hit / (stats.blks_hit + stats.blks_read)) * 100).toFixed(1)
      : '—';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-[16px] font-semibold">{db}</h1>
          <span className="text-[12px] text-[var(--muted)]">База данных</span>
        </div>
        <div className="mt-3">
          <Tabs
            value={view}
            onChange={(v) => setView(v as 'info' | 'service' | 'analysis')}
            items={[
              { value: 'info', label: 'Информация' },
              { value: 'service', label: 'Сервис' },
              { value: 'analysis', label: 'Анализ' },
            ]}
          />
        </div>
      </div>

      {loading && !info ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Loader />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {view === 'info' ? (
            info ? (
              <div className="flex flex-col gap-5">
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Размер</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-3">
                    <Info label="Всего" value={info.total_size} mono />
                    <Info label="Таблицы" value={info.tables_size} mono />
                    <Info label="Индексы" value={info.indexes_size} mono />
                  </div>
                </section>
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Сведения</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-3">
                    <Info label="Таблиц" value={info.table_count.toLocaleString('ru-RU')} mono />
                    <Info label="Индексов" value={info.index_count.toLocaleString('ru-RU')} mono />
                    <Info label="Схем" value={info.schema_count.toLocaleString('ru-RU')} mono />
                    <Info label="Активных соединений" value={info.active_connections.toLocaleString('ru-RU')} mono />
                    <Info label="Владелец" value={info.owner} mono />
                    <Info label="Кодировка" value={info.encoding} mono />
                    <Info label="Collation" value={info.collation} mono />
                    <Info label="Ctype" value={info.ctype} mono />
                    <Info
                      label="Лимит соединений"
                      value={info.connection_limit === -1 ? 'без ограничений' : String(info.connection_limit)}
                      mono
                    />
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-[12px] text-[var(--null)]">Нет данных</div>
            )
          ) : view === 'service' ? (
            <div className="flex flex-col gap-5">
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Обслуживание</h2>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button disabled={busy === 'vacuum'} onClick={() => action('vacuum', () => api.dbVacuum(id, db))}>
                    <Eraser size={14} />
                    VACUUM
                  </Button>
                  <Button disabled={busy === 'analyze'} onClick={() => action('analyze', () => api.dbAnalyze(id, db))}>
                    <Sparkles size={14} />
                    ANALYZE
                  </Button>
                  <Button disabled={busy === 'reindex'} onClick={() => action('reindex', () => api.dbReindex(id, db))}>
                    <RotateCcw size={14} />
                    REINDEX DATABASE
                  </Button>
                </div>
                <div className="text-[11px] text-[var(--faint)]">
                  Операции применяются ко всей базе данных и могут занять время.
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Статистика</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-4">
                  <Info label="Соединений" value={String(stats?.numbackends ?? 0)} mono />
                  <Info label="Транзакций (commit)" value={(stats?.xact_commit ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Транзакций (rollback)" value={(stats?.xact_rollback ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Deadlocks" value={(stats?.deadlocks ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Блоков прочитано" value={(stats?.blks_read ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Блоков из кэша" value={(stats?.blks_hit ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Попадание в кэш" value={`${cacheHits}%`} mono />
                  <Info label="Строк возвращено" value={(stats?.tup_returned ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Строк выбрано" value={(stats?.tup_fetched ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Строк вставлено" value={(stats?.tup_inserted ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Строк обновлено" value={(stats?.tup_updated ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Строк удалено" value={(stats?.tup_deleted ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Временных файлов" value={(stats?.temp_files ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Объём temp" value={formatBytes(stats?.temp_bytes ?? 0)} mono />
                  <Info label="Конфликтов" value={(stats?.conflicts ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Сброс статистики" value={formatDateRel(stats?.stats_reset ?? null)} />
                </div>
              </section>
            </div>
          ) : (
            <AnalysisTable rows={analysisRows} showSchema exportName={`${db}_tables`} />
          )}
        </div>
      )}
    </div>
  );
}
