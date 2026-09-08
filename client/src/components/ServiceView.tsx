import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Sparkles, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Loader, Badge } from './ui';
import type { ServiceResult } from '../types';

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function relativeLabel(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} ${plural(w, 'неделю', 'недели', 'недель')} назад`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} ${plural(m, 'месяц', 'месяца', 'месяцев')} назад`;
  }
  const y = Math.floor(days / 365);
  return `${y} ${plural(y, 'год', 'года', 'лет')} назад`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const rel = relativeLabel(s);
  return rel ? `${d.toLocaleString('ru-RU')} (${rel})` : d.toLocaleString('ru-RU');
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-[#5c6478]">{label}</div>
      <div className={`text-[12.5px] text-[#e7eaf0] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

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
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Таблица</h2>
            {t ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[#272c39] bg-[#12151c] p-4 md:grid-cols-3">
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
              <div className="text-[12px] text-[#6b7390]">Нет данных</div>
            )}
          </section>

          {/* Индексы */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Индексы</h2>
              <span className="font-mono text-[11px] text-[#5c6478]">{data?.indexes.length ?? 0}</span>
              <div className="flex-1" />
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

            <div className="overflow-hidden rounded-lg border border-[#272c39]">
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-[#181c26] text-left">
                    <th className="border-b border-[#333a4a] px-3 py-2 font-medium text-[#8b93a7]">Индекс</th>
                    <th className="border-b border-[#333a4a] px-3 py-2 font-medium text-[#8b93a7]">Тип</th>
                    <th className="border-b border-[#333a4a] px-3 py-2 font-medium text-[#8b93a7]">Размер</th>
                    <th className="border-b border-[#333a4a] px-3 py-2 text-right font-medium text-[#8b93a7]">Скан.</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.indexes.map((ix) => (
                    <tr key={ix.name} className="border-b border-[#272c39] align-top hover:bg-[#1e2330]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#e7eaf0]">{ix.name}</span>
                          {ix.is_primary && <Badge kind="pk">PK</Badge>}
                          {ix.is_unique && !ix.is_primary && <Badge kind="fk">UNIQUE</Badge>}
                          {!ix.is_valid && <Badge kind="kind">invalid</Badge>}
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
                        <div className="mt-1 max-w-[560px] truncate text-[10.5px] text-[#5c6478]" title={ix.definition}>
                          {ix.definition}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[#7fd4ff]">{ix.access_method}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-[#e7eaf0]">{ix.size}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[#c9d2ff]">
                        {ix.idx_scan.toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                  {!data?.indexes.length && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-center text-[#6b7390]">
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
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">
                  Пространственный индекс
                </h2>
                <span className="font-mono text-[11px] text-[#5c6478]">{geoCols.join(', ')}</span>
              </div>

              {data?.spatial_indexes.map((si) => (
                <div key={si.name} className="mb-2 rounded-lg border border-[#272c39] bg-[#12151c] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#e7eaf0]">{si.name}</span>
                    <Badge kind="kind">{si.access_method}</Badge>
                    <span className="font-mono text-[11px] text-[#5c6478]">{si.size}</span>
                    <span className="font-mono text-[11px] text-[#8b93a7]">→ {si.column_name}</span>
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
                  <div className="mt-1 max-w-[560px] truncate text-[10.5px] text-[#5c6478]" title={si.definition}>
                    {si.definition}
                  </div>
                </div>
              ))}

              {missingCols.map((col) => (
                <div
                  key={col}
                  className="flex items-center justify-between rounded-lg border border-dashed border-[#333a4a] bg-[#12151c] p-3"
                >
                  <span className="text-[12px] text-[#8b93a7]">
                    Нет индекса для <span className="font-mono text-[#e7eaf0]">{col}</span>
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
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Обслуживание</h2>
            <div className="rounded-lg border border-[#272c39] bg-[#12151c] p-4">
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                <div className="rounded-md border border-[#272c39] bg-[#0e1015] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#e7eaf0]">VACUUM</span>
                    <Button
                      size="xs"
                      disabled={busy === 'vacuum'}
                      onClick={() => action('vacuum', () => api.vacuum(id, sel.db, sel.schema, sel.table))}
                    >
                      <Eraser size={12} />
                      VACUUM
                    </Button>
                  </div>
                  <Info label="Последний (вручную)" value={fmtDate(st?.last_vacuum)} />
                  <div className="mt-1.5">
                    <Info label="Последний (autovacuum)" value={fmtDate(st?.last_autovacuum)} />
                  </div>
                  <div className="mt-1.5">
                    <Info label="Запусков (вручную / авто)" value={`${st?.vacuum_count ?? 0} / ${st?.autovacuum_count ?? 0}`} mono />
                  </div>
                </div>

                <div className="rounded-md border border-[#272c39] bg-[#0e1015] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#e7eaf0]">ANALYZE</span>
                    <Button
                      size="xs"
                      disabled={busy === 'analyze'}
                      onClick={() => action('analyze', () => api.analyze(id, sel.db, sel.schema, sel.table))}
                    >
                      <Sparkles size={12} />
                      ANALYZE
                    </Button>
                  </div>
                  <Info label="Последний (вручную)" value={fmtDate(st?.last_analyze)} />
                  <div className="mt-1.5">
                    <Info label="Последний (autoanalyze)" value={fmtDate(st?.last_autoanalyze)} />
                  </div>
                  <div className="mt-1.5">
                    <Info label="Запусков (вручную / авто)" value={`${st?.analyze_count ?? 0} / ${st?.autoanalyze_count ?? 0}`} mono />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[#272c39] pt-3 md:grid-cols-3">
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
