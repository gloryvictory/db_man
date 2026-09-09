import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Sparkles, RotateCcw, Copy, Download } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Tabs, Info, Input } from './ui';
import AnalysisTable from './AnalysisTable';
import { SqlCode } from '../lib/sqlHighlight';
import { formatDateRel, formatBytes } from '../lib/format';
import { downloadText } from '../lib/export';
import type { DatabaseInfo, DatabaseStats, DatabaseTableRow, ServerConfigRow } from '../types';

export default function DatabaseView() {
  const store = useStore();
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [analysisRows, setAnalysisRows] = useState<DatabaseTableRow[]>([]);
  const [configRows, setConfigRows] = useState<ServerConfigRow[] | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSearch, setConfigSearch] = useState('');
  const [ddl, setDdl] = useState<string | null>(null);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [view, setView] = useState<'info' | 'service' | 'analysis' | 'config' | 'ddl'>('info');
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

  const loadConfig = useCallback(async () => {
    if (!id || !db || configRows) return;
    setConfigLoading(true);
    try {
      setConfigRows(await api.databaseConfig(id, db));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setConfigLoading(false);
    }
  }, [id, db, configRows]);

  useEffect(() => {
    if (view === 'config') loadConfig();
  }, [view, loadConfig]);

  const loadDdl = useCallback(async () => {
    if (!id || !db || ddl) return;
    setDdlLoading(true);
    try {
      setDdl((await api.databaseDdl(id, db)).ddl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDdlLoading(false);
    }
  }, [id, db, ddl]);

  useEffect(() => {
    if (view === 'ddl') loadDdl();
  }, [view, loadDdl]);

  function copyDdl() {
    if (!ddl) return;
    navigator.clipboard.writeText(ddl).then(() => toast.success('Скопировано'));
  }

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

  const filteredConfig = (configRows ?? []).filter(
    (c) =>
      !configSearch ||
      c.name.toLowerCase().includes(configSearch.toLowerCase()) ||
      c.value.toLowerCase().includes(configSearch.toLowerCase())
  );

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
            onChange={(v) => setView(v as 'info' | 'service' | 'analysis' | 'config' | 'ddl')}
            items={[
              { value: 'info', label: 'Информация' },
              { value: 'service', label: 'Сервис' },
              { value: 'analysis', label: 'Анализ' },
              { value: 'config', label: 'Конфигурация' },
              { value: 'ddl', label: 'DDL' },
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
          ) : view === 'config' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  className="max-w-[300px]"
                  placeholder="Поиск параметра…"
                  value={configSearch}
                  onChange={(e) => setConfigSearch(e.target.value)}
                />
                <span className="font-mono text-[11px] text-[var(--faint)]">
                  {filteredConfig.length} / {configRows?.length ?? 0}
                </span>
              </div>
              {configLoading ? (
                <div className="grid h-40 place-items-center">
                  <Loader />
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <thead>
                      <tr className="bg-[var(--surface)] text-left">
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Параметр</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Значение</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConfig.map((c) => (
                        <tr key={c.name} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                          <td className="px-3 py-1.5 text-[var(--text)]">{c.name}</td>
                          <td className="px-3 py-1.5 text-[var(--cyan)]">{c.value}</td>
                        </tr>
                      ))}
                      {filteredConfig.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-center text-[var(--null)]">
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : view === 'ddl' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button size="xs" variant="subtle" onClick={copyDdl} disabled={!ddl}>
                  <Copy size={12} />
                  Скопировать
                </Button>
                <Button size="xs" variant="subtle" onClick={() => ddl && downloadText(`${db}.sql`, ddl)} disabled={!ddl}>
                  <Download size={12} />
                  Экспорт
                </Button>
                <span className="font-mono text-[11px] text-[var(--faint)]">
                  {ddl ? `${ddl.length.toLocaleString('ru-RU')} симв.` : ''}
                </span>
              </div>
              {ddlLoading ? (
                <div className="grid h-40 place-items-center">
                  <Loader />
                </div>
              ) : ddl ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                  <SqlCode sql={ddl} />
                </div>
              ) : null}
            </div>
          ) : (
            <AnalysisTable rows={analysisRows} showSchema exportName={`${db}_tables`} />
          )}
        </div>
      )}
    </div>
  );
}
