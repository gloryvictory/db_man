import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Tabs, Info } from './ui';
import { formatBytes, formatDateRel } from '../lib/format';
import type { SchemaInfo, SchemaTableRow } from '../types';

type SortState = { col: string; dir: 'asc' | 'desc' } | null;

function Th({
  col,
  label,
  right,
  sort,
  onSort,
}: {
  col: string;
  label: string;
  right?: boolean;
  sort: SortState;
  onSort: (c: string) => void;
}) {
  const active = sort?.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`cursor-pointer select-none whitespace-nowrap border-b border-[#333a4a] px-3 py-2 font-medium text-[#8b93a7] ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {label}
      {active && <span className="ml-1 text-[#35c98e]">{sort!.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

export default function SchemaView() {
  const store = useStore();
  const [info, setInfo] = useState<SchemaInfo | null>(null);
  const [rows, setRows] = useState<SchemaTableRow[]>([]);
  const [view, setView] = useState<'info' | 'analysis'>('info');
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortState>(null);

  const id = store.activeConnId;
  const schema = store.selectedSchema;

  const load = useCallback(async () => {
    if (!id || !schema) return;
    setLoading(true);
    try {
      const [i, a] = await Promise.all([
        api.schemaInfo(id, schema.db, schema.schema),
        api.schemaAnalysis(id, schema.db, schema.schema),
      ]);
      setInfo(i);
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

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.col];
      const bv = (b as unknown as Record<string, unknown>)[sort.col];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return cmp * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [rows, sort]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          rows: acc.rows + r.row_estimate,
          table_size: acc.table_size + r.table_size,
          indexes_size: acc.indexes_size + r.indexes_size,
          total_size: acc.total_size + r.total_size,
        }),
        { rows: 0, table_size: 0, indexes_size: 0, total_size: 0 }
      ),
    [rows]
  );

  function toggleSort(col: string) {
    setSort((s) => (s?.col === col ? (s.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }));
  }

  if (!id || !schema) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0e1015]">
      <div className="border-b border-[#272c39] px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-[16px] font-semibold">{schema.schema}</h1>
          <span className="text-[12px] text-[#8b93a7]">Схема</span>
        </div>
        <div className="mt-3">
          <Tabs
            value={view}
            onChange={(v) => setView(v as 'info' | 'analysis')}
            items={[
              { value: 'info', label: 'Информация' },
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
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Размер</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[#272c39] bg-[#12151c] p-4 md:grid-cols-4">
                    <Info label="Всего" value={info.total_size} mono />
                    <Info label="Таблицы" value={info.tables_size} mono />
                    <Info label="Индексы" value={info.indexes_size} mono />
                    <Info label="TOAST" value={info.toast_size} mono />
                  </div>
                </section>
                <section>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Сведения</h2>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-[#272c39] bg-[#12151c] p-4 md:grid-cols-3">
                    <Info label="Таблиц" value={info.table_count.toLocaleString('ru-RU')} mono />
                    <Info label="Индексов" value={info.index_count.toLocaleString('ru-RU')} mono />
                    <Info label="Владелец" value={info.owner} mono />
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-[12px] text-[#6b7390]">Нет данных</div>
            )
          ) : (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Таблицы</h2>
                <span className="font-mono text-[11px] text-[#5c6478]">{rows.length}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-[#272c39]">
                <table className="w-full border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="bg-[#181c26]">
                      <Th col="name" label="Имя таблицы" sort={sort} onSort={toggleSort} />
                      <Th col="kind" label="Тип" sort={sort} onSort={toggleSort} />
                      <Th col="column_count" label="Колонок" right sort={sort} onSort={toggleSort} />
                      <Th col="row_estimate" label="Строк (оценка)" right sort={sort} onSort={toggleSort} />
                      <Th col="table_size" label="Таблица" right sort={sort} onSort={toggleSort} />
                      <Th col="indexes_size" label="Индексы" right sort={sort} onSort={toggleSort} />
                      <Th col="total_size" label="Всего" right sort={sort} onSort={toggleSort} />
                      <Th col="last_vacuum" label="VACUUM" sort={sort} onSort={toggleSort} />
                      <Th col="last_analyze" label="ANALYZE" sort={sort} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r) => (
                      <tr key={r.name} className="border-b border-[#272c39] hover:bg-[#1e2330]">
                        <td className="px-3 py-1.5 text-[#e7eaf0]">{r.name}</td>
                        <td className="px-3 py-1.5 text-[#8b93a7]">{r.kind}</td>
                        <td className="px-3 py-1.5 text-right text-[#c9d2ff]">{r.column_count}</td>
                        <td className="px-3 py-1.5 text-right text-[#e7eaf0]">{r.row_estimate.toLocaleString('ru-RU')}</td>
                        <td className="px-3 py-1.5 text-right text-[#e7eaf0]">{formatBytes(r.table_size)}</td>
                        <td className="px-3 py-1.5 text-right text-[#e7eaf0]">{formatBytes(r.indexes_size)}</td>
                        <td className="px-3 py-1.5 text-right text-[#e7eaf0]">{formatBytes(r.total_size)}</td>
                        <td className="px-3 py-1.5 text-[#5c6478]">{formatDateRel(r.last_vacuum)}</td>
                        <td className="px-3 py-1.5 text-[#5c6478]">{formatDateRel(r.last_analyze)}</td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-3 text-center text-[#6b7390]">
                          Таблиц нет
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#333a4a] bg-[#181c26] font-semibold text-[#e7eaf0]">
                      <td className="px-3 py-1.5">Итого</td>
                      <td />
                      <td />
                      <td className="px-3 py-1.5 text-right">{totals.rows.toLocaleString('ru-RU')}</td>
                      <td className="px-3 py-1.5 text-right">{formatBytes(totals.table_size)}</td>
                      <td className="px-3 py-1.5 text-right">{formatBytes(totals.indexes_size)}</td>
                      <td className="px-3 py-1.5 text-right">{formatBytes(totals.total_size)}</td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
