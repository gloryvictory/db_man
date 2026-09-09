import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui';
import { formatBytes, formatDateRel } from '../lib/format';
import { exportToExcel } from '../lib/export';

export interface AnalysisRow {
  schema?: string;
  name: string;
  kind: string;
  comment: string | null;
  column_count: number;
  row_estimate: number;
  table_size: number;
  indexes_size: number;
  total_size: number;
  dead_tup: number;
  dead_ratio: number;
  mod_since_analyze: number;
  needs_analyze: boolean;
  unused_index_count: number;
  unused_index_bytes: number;
  duplicate_index_count: number;
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
      className={`cursor-pointer select-none whitespace-nowrap border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)] ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {label}
      {active && <span className="ml-1 text-[var(--accent)]">{sort!.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

function bloatColor(ratio: number): string {
  if (ratio > 0.2) return 'var(--red)';
  if (ratio > 0.05) return 'var(--amber)';
  return 'var(--faint)';
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
          dead_tup: acc.dead_tup + r.dead_tup,
          unused_index_count: acc.unused_index_count + r.unused_index_count,
          unused_index_bytes: acc.unused_index_bytes + r.unused_index_bytes,
          duplicate_index_count: acc.duplicate_index_count + r.duplicate_index_count,
        }),
        {
          rows: 0,
          table_size: 0,
          indexes_size: 0,
          total_size: 0,
          dead_tup: 0,
          unused_index_count: 0,
          unused_index_bytes: 0,
          duplicate_index_count: 0,
        }
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
      'Комментарий',
      'Тип',
      'Колонок',
      'Строк (оценка)',
      'Таблица',
      'Индексы',
      'Неисп. индексы',
      'Дубл. индексы',
      'Всего',
      'Bloat %',
      'Мёртвых строк',
      'VACUUM',
      'ANALYZE',
      'Нужен ANALYZE',
    ];
    const data = sorted.map((r) => [
      ...(showSchema ? [r.schema ?? ''] : []),
      r.name,
      r.comment ?? '',
      r.kind,
      r.column_count,
      r.row_estimate,
      formatBytes(r.table_size),
      formatBytes(r.indexes_size),
      r.unused_index_count,
      r.duplicate_index_count,
      formatBytes(r.total_size),
      `${(r.dead_ratio * 100).toFixed(1)}%`,
      r.dead_tup,
      r.last_vacuum ? new Date(r.last_vacuum).toLocaleString('ru-RU') : '',
      r.last_analyze ? new Date(r.last_analyze).toLocaleString('ru-RU') : '',
      r.needs_analyze ? 'да' : 'нет',
    ]);
    exportToExcel(exportName, header, data);
  }

  const colCount = 13 + (showSchema ? 1 : 0);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Таблицы</h2>
        <span className="font-mono text-[11px] text-[var(--faint)]">{rows.length}</span>
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={doExport}>
          <Download size={12} />
          Экспорт
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="bg-[var(--surface)]">
              {showSchema && <Th col="schema" label="Схема" sort={sort} onSort={toggleSort} />}
              <Th col="name" label="Имя таблицы" sort={sort} onSort={toggleSort} />
              <Th col="comment" label="Комментарий" sort={sort} onSort={toggleSort} />
              <Th col="kind" label="Тип" sort={sort} onSort={toggleSort} />
              <Th col="column_count" label="Колонок" right sort={sort} onSort={toggleSort} />
              <Th col="row_estimate" label="Строк (оценка)" right sort={sort} onSort={toggleSort} />
              <Th col="table_size" label="Таблица" right sort={sort} onSort={toggleSort} />
              <Th col="indexes_size" label="Индексы" right sort={sort} onSort={toggleSort} />
              <Th col="unused_index_count" label="Неисп. индексы" right sort={sort} onSort={toggleSort} />
              <Th col="duplicate_index_count" label="Дубл. индексы" right sort={sort} onSort={toggleSort} />
              <Th col="total_size" label="Всего" right sort={sort} onSort={toggleSort} />
              <Th col="dead_ratio" label="Bloat %" right sort={sort} onSort={toggleSort} />
              <Th col="last_vacuum" label="VACUUM" sort={sort} onSort={toggleSort} />
              <Th col="last_analyze" label="ANALYZE" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={`${r.schema ?? ''}.${r.name}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                {showSchema && <td className="px-3 py-1.5 text-[var(--amber)]">{r.schema}</td>}
                <td className="px-3 py-1.5 text-[var(--text)]">{r.name}</td>
                <td className="px-3 py-1.5 text-[var(--muted)]">
                  {r.comment ?? <span className="text-[var(--null)]">—</span>}
                </td>
                <td className="px-3 py-1.5 text-[var(--muted)]">{r.kind}</td>
                <td className="px-3 py-1.5 text-right text-[var(--violet)]">{r.column_count}</td>
                <td className="px-3 py-1.5 text-right text-[var(--text)]">{r.row_estimate.toLocaleString('ru-RU')}</td>
                <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(r.table_size)}</td>
                <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(r.indexes_size)}</td>
                <td
                  className="px-3 py-1.5 text-right"
                  title={r.unused_index_count ? formatBytes(r.unused_index_bytes) : undefined}
                  style={{ color: r.unused_index_count > 0 ? 'var(--amber)' : 'var(--faint)' }}
                >
                  {r.unused_index_count || '—'}
                </td>
                <td
                  className="px-3 py-1.5 text-right"
                  style={{ color: r.duplicate_index_count > 0 ? 'var(--red)' : 'var(--faint)' }}
                >
                  {r.duplicate_index_count || '—'}
                </td>
                <td className="px-3 py-1.5 text-right text-[var(--text)]">{formatBytes(r.total_size)}</td>
                <td
                  className="px-3 py-1.5 text-right"
                  title={`мёртвых кортежей: ${r.dead_tup.toLocaleString('ru-RU')}`}
                  style={{ color: bloatColor(r.dead_ratio) }}
                >
                  {r.dead_ratio > 0 ? `${(r.dead_ratio * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-1.5 text-[var(--faint)]">{formatDateRel(r.last_vacuum)}</td>
                <td className="px-3 py-1.5 text-[var(--faint)]">
                  {formatDateRel(r.last_analyze)}
                  {r.needs_analyze && (
                    <span className="ml-1.5 rounded bg-[var(--amber-bg)] px-1 py-0.5 text-[9px] font-semibold text-[var(--amber)]">
                      нужен
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-3 text-center text-[var(--null)]">
                  Таблиц нет
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border-strong)] bg-[var(--surface)] font-semibold text-[var(--text)]">
              {showSchema ? <td /> : null}
              <td className="px-3 py-1.5">Итого</td>
              <td />
              <td />
              <td />
              <td className="px-3 py-1.5 text-right">{totals.rows.toLocaleString('ru-RU')}</td>
              <td className="px-3 py-1.5 text-right">{formatBytes(totals.table_size)}</td>
              <td className="px-3 py-1.5 text-right">{formatBytes(totals.indexes_size)}</td>
              <td className="px-3 py-1.5 text-right" style={{ color: totals.unused_index_count ? 'var(--amber)' : 'var(--faint)' }}>
                {totals.unused_index_count || '—'}
              </td>
              <td className="px-3 py-1.5 text-right" style={{ color: totals.duplicate_index_count ? 'var(--red)' : 'var(--faint)' }}>
                {totals.duplicate_index_count || '—'}
              </td>
              <td className="px-3 py-1.5 text-right">{formatBytes(totals.total_size)}</td>
              <td className="px-3 py-1.5 text-right">{totals.dead_tup.toLocaleString('ru-RU')}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
