import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui';
import { formatBytes, formatDateRel } from '../lib/format';
import { exportToExcel } from '../lib/export';

export interface AnalysisRow {
  schema?: string;
  name: string;
  kind: string;
  column_count: number;
  row_estimate: number;
  table_size: number;
  indexes_size: number;
  total_size: number;
  last_vacuum: string | null;
  last_analyze: string | null;
}

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

export default function AnalysisTable({
  rows,
  showSchema = false,
  exportName,
}: {
  rows: AnalysisRow[];
  showSchema?: boolean;
  exportName: string;
}) {
  const [sort, setSort] = useState<SortState>(null);

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

  function doExport() {
    const header = [
      ...(showSchema ? ['Схема'] : []),
      'Имя таблицы',
      'Тип',
      'Колонок',
      'Строк (оценка)',
      'Таблица',
      'Индексы',
      'Всего',
      'VACUUM',
      'ANALYZE',
    ];
    const data = sorted.map((r) => [
      ...(showSchema ? [r.schema ?? ''] : []),
      r.name,
      r.kind,
      r.column_count,
      r.row_estimate,
      formatBytes(r.table_size),
      formatBytes(r.indexes_size),
      formatBytes(r.total_size),
      r.last_vacuum ? new Date(r.last_vacuum).toLocaleString('ru-RU') : '',
      r.last_analyze ? new Date(r.last_analyze).toLocaleString('ru-RU') : '',
    ]);
    exportToExcel(exportName, header, data);
  }

  const colCount = 9 + (showSchema ? 1 : 0);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Таблицы</h2>
        <span className="font-mono text-[11px] text-[#5c6478]">{rows.length}</span>
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={doExport}>
          <Download size={12} />
          Экспорт
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#272c39]">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="bg-[#181c26]">
              {showSchema && <Th col="schema" label="Схема" sort={sort} onSort={toggleSort} />}
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
              <tr key={`${r.schema ?? ''}.${r.name}`} className="border-b border-[#272c39] hover:bg-[#1e2330]">
                {showSchema && <td className="px-3 py-1.5 text-[#e0a94f]">{r.schema}</td>}
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
                <td colSpan={colCount} className="px-3 py-3 text-center text-[#6b7390]">
                  Таблиц нет
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#333a4a] bg-[#181c26] font-semibold text-[#e7eaf0]">
              {showSchema ? <td /> : null}
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
  );
}
