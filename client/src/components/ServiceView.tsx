import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Sparkles, RotateCcw, Download } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Badge, Info } from './ui';
import { formatDateRel } from '../lib/format';
import { exportToExcel } from '../lib/export';
import type { ServiceResult } from '../types';

export default function ServiceView() {
  const store = useStore();
  const [data, setData] = useState<ServiceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const id = store.activeConnId;
  const sel = store.selected;

  const load = useCallback(async () => {
    if (!id || !sel) return;
    setLoading(true);
    try {
      setData(await api.service(id, sel.db, sel.schema, sel.table));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, sel]);

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

  function exportIndexes() {
    const header = ['Индекс', 'Тип', 'Размер', 'Уникальный', 'Primary', 'Valid', 'Скан.', 'Не используется', 'Дубликат', 'Определение'];
    const rows = (data?.indexes ?? []).map((ix) => [
      ix.name,
      ix.access_method,
      ix.size,
      ix.is_unique ? 'да' : 'нет',
      ix.is_primary ? 'да' : 'нет',
      ix.is_valid ? 'да' : 'нет',
      ix.idx_scan,
      ix.unused ? 'да' : 'нет',
      ix.duplicate ? 'да' : 'нет',
      ix.definition,
    ]);
    exportToExcel(`${sel?.table ?? 'table'}_indexes`, header, rows);
  }

  if (!id || !sel) return null;

  const t = data?.table;
  const st = data?.stats;
  const geoCols = data?.geometry_columns ?? [];
  const indexedCols = new Set((data?.spatial_indexes ?? []).map((si) => si.column_name));
  const missingCols = geoCols.filter((c) => !indexedCols.has(c));

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {loading && !data ? (
        <div className="grid h-40 place-items-center">
          <Loader />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Таблица */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Таблица</h2>
            {t ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-3">
                <Info label="Всего" value={t.total_size} mono />
                <Info label="Таблица" value={t.table_size} mono />
                <Info label="Индексы" value={t.indexes_size} mono />
                <Info label="TOAST" value={t.toast_size} mono />
                <Info label="Табличное пространство" value={t.tablespace} mono />
                <Info label="relfilenode" value={t.relfilenode} mono />
                <Info label="Оценка строк" value={t.estimated_rows.toLocaleString('ru-RU')} mono />
                <Info label="Страниц (relpages)" value={t.relpages.toLocaleString('ru-RU')} mono />
                <Info label="Метод доступа" value={t.access_method} mono />
              </div>
            ) : (
              <div className="text-[12px] text-[var(--null)]">Нет данных</div>
            )}
          </section>

          {/* Индексы */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Индексы</h2>
              <span className="font-mono text-[11px] text-[var(--faint)]">{data?.indexes.length ?? 0}</span>
              <div className="flex-1" />
              <Button size="xs" variant="subtle" onClick={exportIndexes}>
                <Download size={12} />
                Экспорт
              </Button>
              <Button
                size="xs"
                variant="subtle"
                disabled={busy === 'reindex-all'}
                onClick={() => action('reindex-all', () => api.reindexAll(id, sel.db, sel.schema, sel.table))}
              >
                <RotateCcw size={12} />
                Перестроить все
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-[var(--surface)] text-left">
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Индекс</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Тип</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Размер</th>
                    <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Скан.</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.indexes.map((ix) => (
                    <tr key={ix.name} className="border-b border-[var(--border)] align-top hover:bg-[var(--surface-hover)]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text)]">{ix.name}</span>
                          {ix.is_primary && <Badge kind="pk">PK</Badge>}
                          {ix.is_unique && !ix.is_primary && <Badge kind="fk">UNIQUE</Badge>}
                          {!ix.is_valid && <Badge kind="kind">invalid</Badge>}
                          {ix.unused && (
                            <span className="rounded bg-[var(--amber-bg)] px-1 py-0.5 text-[9px] font-semibold text-[var(--amber)]">
                              не используется
                            </span>
                          )}
                          {ix.duplicate && (
                            <span className="rounded bg-[var(--red-bg)] px-1 py-0.5 text-[9px] font-semibold text-[var(--red)]">
                              дубликат
                            </span>
                          )}
                          <Button
                            size="xs"
                            disabled={busy === `reindex:${ix.name}`}
                            onClick={() =>
                              action(`reindex:${ix.name}`, () => api.reindex(id, sel.db, sel.schema, sel.table, ix.name))
                            }
                          >
                            {busy === `reindex:${ix.name}` ? '…' : 'Перестроить'}
                          </Button>
                        </div>
                        <div className="mt-1 max-w-[560px] truncate text-[10.5px] text-[var(--faint)]" title={ix.definition}>
                          {ix.definition}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--cyan)]">{ix.access_method}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--text)]">{ix.size}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[var(--violet)]">
                        {ix.idx_scan.toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                  {!data?.indexes.length && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-center text-[var(--null)]">
                        Индексов нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Пространственный индекс */}
          {geoCols.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Пространственный индекс
                </h2>
                <span className="font-mono text-[11px] text-[var(--faint)]">{geoCols.join(', ')}</span>
              </div>

              {data?.spatial_indexes.map((si) => (
                <div key={si.name} className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[var(--text)]">{si.name}</span>
                    <Badge kind="kind">{si.access_method}</Badge>
                    <span className="font-mono text-[11px] text-[var(--faint)]">{si.size}</span>
                    <span className="font-mono text-[11px] text-[var(--muted)]">→ {si.column_name}</span>
                    <div className="flex-1" />
                    <Button
                      size="xs"
                      disabled={busy === `reindex:${si.name}`}
                      onClick={() =>
                        action(`reindex:${si.name}`, () => api.reindex(id, sel.db, sel.schema, sel.table, si.name))
                      }
                    >
                      {busy === `reindex:${si.name}` ? '…' : 'Перестроить'}
                    </Button>
                  </div>
                  <div className="mt-1 max-w-[560px] truncate text-[10.5px] text-[var(--faint)]" title={si.definition}>
                    {si.definition}
                  </div>
                </div>
              ))}

              {missingCols.map((col) => (
                <div
                  key={col}
                  className="flex items-center justify-between rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-panel)] p-3"
                >
                  <span className="text-[12px] text-[var(--muted)]">
                    Нет индекса для <span className="font-mono text-[var(--text)]">{col}</span>
                  </span>
                  <Button
                    size="xs"
                    disabled={busy === `spatial:${col}`}
                    onClick={() =>
                      action(`spatial:${col}`, () => api.createSpatialIndex(id, sel.db, sel.schema, sel.table, col))
                    }
                  >
                    {busy === `spatial:${col}` ? '…' : 'Создать индекс'}
                  </Button>
                </div>
              ))}
            </section>
          )}

          {/* VACUUM / ANALYZE */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Обслуживание</h2>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[var(--text)]">VACUUM</span>
                    <Button
                      size="xs"
                      disabled={busy === 'vacuum'}
                      onClick={() => action('vacuum', () => api.vacuum(id, sel.db, sel.schema, sel.table))}
                    >
                      <Eraser size={12} />
                      VACUUM
                    </Button>
                  </div>
                  <Info label="Последний (вручную)" value={formatDateRel(st?.last_vacuum)} />
                  <div className="mt-1.5">
                    <Info label="Последний (autovacuum)" value={formatDateRel(st?.last_autovacuum)} />
                  </div>
                  <div className="mt-1.5">
                    <Info label="Запусков (вручную / авто)" value={`${st?.vacuum_count ?? 0} / ${st?.autovacuum_count ?? 0}`} mono />
                  </div>
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[var(--text)]">ANALYZE</span>
                    <Button
                      size="xs"
                      disabled={busy === 'analyze'}
                      onClick={() => action('analyze', () => api.analyze(id, sel.db, sel.schema, sel.table))}
                    >
                      <Sparkles size={12} />
                      ANALYZE
                    </Button>
                  </div>
                  <Info label="Последний (вручную)" value={formatDateRel(st?.last_analyze)} />
                  <div className="mt-1.5">
                    <Info label="Последний (autoanalyze)" value={formatDateRel(st?.last_autoanalyze)} />
                  </div>
                  <div className="mt-1.5">
                    <Info label="Запусков (вручную / авто)" value={`${st?.analyze_count ?? 0} / ${st?.autoanalyze_count ?? 0}`} mono />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[var(--border)] pt-3 md:grid-cols-3">
                <Info label="Живых кортежей" value={(st?.n_live_tup ?? 0).toLocaleString('ru-RU')} mono />
                <Info label="Мёртвых кортежей" value={(st?.n_dead_tup ?? 0).toLocaleString('ru-RU')} mono />
                <Info label="Изменено с ANALYZE" value={(st?.n_mod_since_analyze ?? 0).toLocaleString('ru-RU')} mono />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
