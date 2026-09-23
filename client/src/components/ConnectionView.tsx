import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Download } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Tabs, Info, Input } from './ui';
import { formatBytes, formatDateRel } from '../lib/format';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { ConnectionInfo, ConnectionAnalysisRow, ServerConfigRow } from '../types';

const ANALYSIS_HEADER = [
  'База',
  'Размер',
  'Таблиц',
  'Схем',
  'Строк (оценка)',
  'Мёртвых кортежей',
  'Bloat',
  'Нужен ANALYZE',
  'Последний VACUUM',
  'Последний ANALYZE',
];

const DB_HEADER = ['База', 'Комментарий', 'Владелец', 'Табличное пространство', 'Кодировка', 'Сортировка', 'Ctype', 'Лимит', 'Индексы', 'Размер'];

export default function ConnectionView() {
  const store = useStore();
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [analysis, setAnalysis] = useState<ConnectionAnalysisRow[] | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [configRows, setConfigRows] = useState<ServerConfigRow[] | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSearch, setConfigSearch] = useState('');

  const id = store.activeConnId;
  const conn = store.connections.find((c) => c.id === id);

  const loadInfo = useCallback(async () => {
    if (!id) return;
    setInfoLoading(true);
    try {
      setInfo(await api.connectionInfo(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setInfoLoading(false);
    }
  }, [id]);

  const loadAnalysis = useCallback(async () => {
    if (!id || analysis) return;
    setAnalysisLoading(true);
    try {
      setAnalysis(await api.connectionAnalysis(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setAnalysisLoading(false);
    }
  }, [id, analysis]);

  const refresh = useCallback(async () => {
    if (!id) return;
    setInfoLoading(true);
    setAnalysisLoading(true);
    try {
      const [i, a] = await Promise.all([api.connectionInfo(id), api.connectionAnalysis(id)]);
      setInfo(i);
      setAnalysis(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setInfoLoading(false);
      setAnalysisLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (store.connView === 'analysis') loadAnalysis();
  }, [store.connView, loadAnalysis]);

  const loadConfig = useCallback(async () => {
    if (!id || configRows) return;
    setConfigLoading(true);
    try {
      setConfigRows(await api.connectionConfig(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setConfigLoading(false);
    }
  }, [id, configRows]);

  useEffect(() => {
    if (store.connView === 'config') loadConfig();
  }, [store.connView, loadConfig]);

  if (!id) return null;

  const title = conn ? `${conn.name} · ${conn.host}:${conn.port}` : id;

  const analysisRows = (analysis ?? []).map((r) => [
    r.database,
    formatBytes(r.size_bytes),
    r.table_count,
    r.schema_count,
    r.row_estimate,
    r.dead_tuples,
    r.dead_ratio > 0 ? `${(r.dead_ratio * 100).toFixed(1)}%` : '—',
    r.needs_analyze,
    r.last_vacuum ?? '—',
    r.last_analyze ?? '—',
  ]);

  const dbRows = (info?.databases ?? []).map((d) => [
    d.name,
    d.comment ?? '—',
    d.owner,
    d.tablespace ?? '—',
    d.encoding,
    d.collation,
    d.ctype,
    d.connection_limit === -1 ? 'без ограничений' : d.connection_limit,
    formatBytes(d.indexes_size_bytes),
    formatBytes(d.size_bytes),
  ]);

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
          <h1 className="font-mono text-[16px] font-semibold">{title}</h1>
          <span className="text-[12px] text-[var(--muted)]">Подключение</span>
        </div>
        <div className="mt-3">
          <Tabs
            value={store.connView}
            onChange={(v) => store.setConnView(v as 'info' | 'analysis' | 'config')}
            items={[
              { value: 'info', label: 'Информация' },
              { value: 'analysis', label: 'Анализ' },
              { value: 'config', label: 'Конфигурация' },
            ]}
          />
        </div>
      </div>

      {infoLoading && !info && store.connView === 'info' ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Loader />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {store.connView === 'info' ? (
            info ? (
              <div className="flex flex-col gap-5">
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Сервер</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-4">
                    <Info label="Версия" value={info.server_version} mono />
                    <Info label="Запущен" value={formatDateRel(info.server_start)} />
                    <Info label="Активных соединений" value={info.active_connections.toLocaleString('ru-RU')} mono />
                    <Info label="Суммарный размер" value={formatBytes(info.total_size_bytes)} mono />
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Базы данных ({info.db_count})
                    </h2>
                    <div className="flex gap-2">
                      <Button size="xs" variant="subtle" onClick={() => exportToCsv('connection_databases', DB_HEADER, dbRows)}>
                        <Download size={12} />
                        CSV
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => exportToExcel('connection_databases', DB_HEADER, dbRows)}>
                        <Download size={12} />
                        Excel
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                    <table className="w-full border-collapse font-mono text-[12px]">
                      <thead>
                        <tr className="bg-[var(--surface)] text-left">
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">База</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Комментарий</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Владелец</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Табличное пространство</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Кодировка</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Сортировка</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Ctype</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Лимит</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Индексы</th>
                          <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Размер</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.databases.map((d) => (
                          <tr key={d.name} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]">
                            <td className="px-3 py-1.5 text-[var(--text)]">{d.name}</td>
                            <td className="max-w-[260px] truncate px-3 py-1.5 text-[var(--faint)]" title={d.comment ?? undefined}>
                              {d.comment ?? <span className="text-[var(--null)]">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-[var(--muted)]">{d.owner}</td>
                            <td className="px-3 py-1.5 text-[var(--faint)]">{d.tablespace ?? <span className="text-[var(--null)]">—</span>}</td>
                            <td className="px-3 py-1.5 text-[var(--faint)]">{d.encoding}</td>
                            <td className="px-3 py-1.5 text-[var(--faint)]">{d.collation}</td>
                            <td className="px-3 py-1.5 text-[var(--faint)]">{d.ctype}</td>
                            <td className="px-3 py-1.5 text-right text-[var(--text)]">
                              {d.connection_limit === -1 ? '∞' : d.connection_limit}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[var(--faint)]">{formatBytes(d.indexes_size_bytes)}</td>
                            <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(d.size_bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-[12px] text-[var(--null)]">Нет данных</div>
            )
          ) : store.connView === 'analysis' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button onClick={refresh}>
                  <RefreshCw size={14} />
                  Обновить
                </Button>
                <span className="font-mono text-[11px] text-[var(--faint)]">
                  {analysis ? `${analysis.length} БД` : ''}
                </span>
                <div className="flex-1" />
                <Button size="xs" variant="subtle" onClick={() => exportToCsv('connection_analysis', ANALYSIS_HEADER, analysisRows)}>
                  <Download size={12} />
                  CSV
                </Button>
                <Button size="xs" variant="subtle" onClick={() => exportToExcel('connection_analysis', ANALYSIS_HEADER, analysisRows)}>
                  <Download size={12} />
                  Excel
                </Button>
              </div>

              {analysis === null || analysisLoading ? (
                <div className="grid h-40 place-items-center">
                  <Loader />
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <thead>
                      <tr className="bg-[var(--surface)] text-left">
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">База</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Размер</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Таблиц</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Схем</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Строк (оценка)</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Мёртвых</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Bloat</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Нужен ANALYZE</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Последний VACUUM</th>
                        <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Последний ANALYZE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.map((r) => (
                        <tr key={r.database} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]">
                          <td className="px-3 py-1.5 text-[var(--text)]">{r.database}</td>
                          <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(r.size_bytes)}</td>
                          <td className="px-3 py-1.5 text-right text-[var(--violet)]">{r.table_count.toLocaleString('ru-RU')}</td>
                          <td className="px-3 py-1.5 text-right text-[var(--text)]">{r.schema_count}</td>
                          <td className="px-3 py-1.5 text-right text-[var(--text)]">{r.row_estimate.toLocaleString('ru-RU')}</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: r.dead_tuples > 0 ? 'var(--amber)' : 'var(--faint)' }}>
                            {r.dead_tuples.toLocaleString('ru-RU')}
                          </td>
                          <td className="px-3 py-1.5 text-right" style={{ color: r.dead_ratio > 0.2 ? 'var(--red)' : r.dead_ratio > 0 ? 'var(--amber)' : 'var(--faint)' }}>
                            {r.dead_ratio > 0 ? `${(r.dead_ratio * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {r.needs_analyze > 0 ? <span className="text-[var(--amber)]">{r.needs_analyze}</span> : <span className="text-[var(--faint)]">0</span>}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--faint)]">{r.last_vacuum ? formatDateRel(r.last_vacuum) : '—'}</td>
                          <td className="px-3 py-1.5 text-[var(--faint)]">{r.last_analyze ? formatDateRel(r.last_analyze) : '—'}</td>
                        </tr>
                      ))}
                      {analysis.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-3 py-3 text-center text-[var(--null)]">
                            Нет данных
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
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
                <div className="flex-1" />
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => exportToCsv('server_config', ['Параметр', 'Значение'], filteredConfig.map((c) => [c.name, c.value]))}
                >
                  <Download size={12} />
                  CSV
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => exportToExcel('server_config', ['Параметр', 'Значение'], filteredConfig.map((c) => [c.name, c.value]))}
                >
                  <Download size={12} />
                  Excel
                </Button>
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
          )}
        </div>
      )}
    </div>
  );
}
