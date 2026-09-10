import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Sparkles, RotateCcw, Copy, Download } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Tabs, Info } from './ui';
import AnalysisTable from './AnalysisTable';
import DataQualityView from './DataQualityView';
import { SqlCode } from '../lib/sqlHighlight';
import { downloadText } from '../lib/export';
import { formatDateRel } from '../lib/format';
import type { SchemaInfo, SchemaStats, SchemaTableRow } from '../types';

export default function SchemaView() {
  const store = useStore();
  const [info, setInfo] = useState<SchemaInfo | null>(null);
  const [stats, setStats] = useState<SchemaStats | null>(null);
  const [rows, setRows] = useState<SchemaTableRow[]>([]);
  const [view, setView] = useState<'info' | 'service' | 'analysis' | 'ddl' | 'quality'>('info');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ddl, setDdl] = useState<string | null>(null);
  const [ddlLoading, setDdlLoading] = useState(false);

  const id = store.activeConnId;
  const schema = store.selectedSchema;

  const load = useCallback(async () => {
    if (!id || !schema) return;
    setLoading(true);
    try {
      const [i, s, a] = await Promise.all([
        api.schemaInfo(id, schema.db, schema.schema),
        api.schemaService(id, schema.db, schema.schema),
        api.schemaAnalysis(id, schema.db, schema.schema),
      ]);
      setInfo(i);
      setStats(s);
      setRows(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, schema]);

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

  const loadDdl = useCallback(async () => {
    if (!id || !schema || ddl) return;
    setDdlLoading(true);
    try {
      setDdl((await api.schemaDdl(id, schema.db, schema.schema)).ddl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDdlLoading(false);
    }
  }, [id, schema, ddl]);

  useEffect(() => {
    if (view === 'ddl') loadDdl();
  }, [view, loadDdl]);

  function copyDdl() {
    if (!ddl) return;
    navigator.clipboard.writeText(ddl).then(() => toast.success('Скопировано'));
  }

  if (!id || !schema) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-[16px] font-semibold">{schema.schema}</h1>
          <span className="text-[12px] text-[var(--muted)]">Схема</span>
        </div>
        <div className="mt-3">
          <Tabs
            value={view}
            onChange={(v) => setView(v as 'info' | 'service' | 'analysis' | 'ddl' | 'quality')}
            items={[
              { value: 'info', label: 'Информация' },
              { value: 'service', label: 'Сервис' },
              { value: 'analysis', label: 'Анализ' },
              { value: 'ddl', label: 'DDL' },
              { value: 'quality', label: 'Качество данных' },
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
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-4">
                    <Info label="Всего" value={info.total_size} mono />
                    <Info label="Таблицы" value={info.tables_size} mono />
                    <Info label="Индексы" value={info.indexes_size} mono />
                    <Info label="TOAST" value={info.toast_size} mono />
                  </div>
                </section>
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Сведения</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-3">
                    <Info label="Таблиц" value={info.table_count.toLocaleString('ru-RU')} mono />
                    <Info label="Индексов" value={info.index_count.toLocaleString('ru-RU')} mono />
                    <Info label="Владелец" value={info.owner} mono />
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
                  <Button
                    disabled={busy === 'vacuum'}
                    onClick={() => action('vacuum', () => api.schemaVacuum(id, schema.db, schema.schema))}
                  >
                    <Eraser size={14} />
                    VACUUM
                  </Button>
                  <Button
                    disabled={busy === 'analyze'}
                    onClick={() => action('analyze', () => api.schemaAnalyze(id, schema.db, schema.schema))}
                  >
                    <Sparkles size={14} />
                    ANALYZE
                  </Button>
                  <Button
                    disabled={busy === 'reindex'}
                    onClick={() => action('reindex', () => api.schemaReindex(id, schema.db, schema.schema))}
                  >
                    <RotateCcw size={14} />
                    REINDEX SCHEMA
                  </Button>
                </div>
                <div className="text-[11px] text-[var(--faint)]">
                  Операции применяются ко всем таблицам схемы и могут занять время.
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Статистика</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-4">
                  <Info label="Таблиц" value={(stats?.table_count ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Строк (live)" value={(stats?.live_tup ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Мёртвых строк" value={(stats?.dead_tup ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Вставлено" value={(stats?.n_tup_ins ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Обновлено" value={(stats?.n_tup_upd ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Удалено" value={(stats?.n_tup_del ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="VACUUM" value={(stats?.vacuum_count ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="AUTOVACUUM" value={(stats?.autovacuum_count ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="ANALYZE" value={(stats?.analyze_count ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="AUTOANALYZE" value={(stats?.autoanalyze_count ?? 0).toLocaleString('ru-RU')} mono />
                  <Info label="Последний VACUUM" value={formatDateRel(stats?.last_vacuum ?? null)} />
                  <Info label="Последний AUTOVACUUM" value={formatDateRel(stats?.last_autovacuum ?? null)} />
                  <Info label="Последний ANALYZE" value={formatDateRel(stats?.last_analyze ?? null)} />
                  <Info label="Последний AUTOANALYZE" value={formatDateRel(stats?.last_autoanalyze ?? null)} />
                </div>
              </section>
            </div>
          ) : view === 'ddl' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button size="xs" variant="subtle" onClick={copyDdl} disabled={!ddl}>
                  <Copy size={12} />
                  Скопировать
                </Button>
                <Button size="xs" variant="subtle" onClick={() => ddl && downloadText(`${schema.schema}.sql`, ddl)} disabled={!ddl}>
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
          ) : view === 'quality' ? (
            <DataQualityView id={id} db={schema.db} schema={schema.schema} showSchema={false} />
          ) : (
            <AnalysisTable rows={rows} exportName={`${schema.db}_${schema.schema}_tables`} />
          )}
        </div>
      )}
    </div>
  );
}
