import { useEffect, useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { api } from '../api';
import { Button, Input, Loader, Badge } from './ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { ColumnRow } from '../types';

type SortState = { col: keyof ColumnRow; dir: 'asc' | 'desc' } | null;

const KIND_LABEL: Record<string, string> = {
  table: 'таблица',
  partitioned: 'секц.',
  view: 'представление',
  materialized: 'мат. представление',
};

function Th({ col, label, right, sort, onSort }: { col: keyof ColumnRow; label: string; right?: boolean; sort: SortState; onSort: (c: keyof ColumnRow) => void }) {
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

export default function ColumnsView({ id, db, schema }: { id: string; db: string; schema?: string }) {
  const [rows, setRows] = useState<ColumnRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  useEffect(() => {
    let on = true;
    setRows(null);
    setError(null);
    const p = schema ? api.schemaColumns(id, db, schema) : api.databaseColumns(id, db);
    p.then((r) => on && setRows(r)).catch((e) => on && setError(e instanceof Error ? e.message : 'Ошибка'));
    return () => {
      on = false;
    };
  }, [id, db, schema]);

  const filtered = useMemo(() => {
    const base = rows ?? [];
    const q = search.trim().toLowerCase();
    const f = q
      ? base.filter((r) =>
          [r.schema, r.table, r.name, r.data_type, r.comment ?? '', r.foreign_ref ?? ''].some((s) =>
            s.toLowerCase().includes(q)
          )
        )
      : base;
    if (!sort) return f;
    return [...f].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), 'ru');
      return cmp * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [rows, search, sort]);

  function toggleSort(col: keyof ColumnRow) {
    setSort((s) => (s?.col === col ? (s.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }));
  }

  const exportName = schema ? `${db}_${schema}_columns` : `${db}_columns`;
  const header = [
    ...(schema ? [] : ['Схема']),
    'Таблица',
    'Тип объекта',
    'Колонка',
    'Тип данных',
    '№',
    'PK',
    'NOT NULL',
    'Внешний ключ',
    'По умолчанию',
    'Комментарий',
  ];
  const exportRows = (list: ColumnRow[]) =>
    list.map((r) => [
      ...(schema ? [] : [r.schema]),
      r.table,
      KIND_LABEL[r.table_kind] ?? r.table_kind,
      r.name,
      r.data_type,
      r.position,
      r.is_primary ? 'PK' : '',
      r.not_null ? 'NOT NULL' : '',
      r.foreign_ref ?? '',
      r.default_value ?? '',
      r.comment ?? '',
    ]);

  function doExcel() {
    exportToExcel(exportName, header, exportRows(filtered));
  }
  function doCsv() {
    exportToCsv(exportName, header, exportRows(filtered));
  }

  const total = rows?.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Колонки</h2>
        <span className="font-mono text-[11px] text-[var(--faint)]">
          {rows === null ? '…' : `${filtered.length}${search ? ` из ${total}` : ''}`}
        </span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по схеме, таблице, колонке, типу…"
            className="w-[300px] pl-7"
          />
        </div>
        <Button size="xs" variant="subtle" onClick={doCsv} disabled={!rows?.length}>
          <Download size={12} />
          CSV
        </Button>
        <Button size="xs" variant="subtle" onClick={doExcel} disabled={!rows?.length}>
          <Download size={12} />
          Excel
        </Button>
      </div>

      {rows === null ? (
        <div className="grid h-40 place-items-center">
          <Loader />
        </div>
      ) : error ? (
        <div className="rounded-md border border-[var(--red)] p-3 font-mono text-[12px] text-[var(--red)]">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-[var(--surface)]">
                {!schema && <Th col="schema" label="Схема" sort={sort} onSort={toggleSort} />}
                <Th col="table" label="Таблица" sort={sort} onSort={toggleSort} />
                <Th col="table_kind" label="Тип" sort={sort} onSort={toggleSort} />
                <Th col="name" label="Колонка" sort={sort} onSort={toggleSort} />
                <Th col="data_type" label="Тип данных" sort={sort} onSort={toggleSort} />
                <Th col="position" label="№" right sort={sort} onSort={toggleSort} />
                <Th col="is_primary" label="PK" sort={sort} onSort={toggleSort} />
                <Th col="not_null" label="NOT NULL" sort={sort} onSort={toggleSort} />
                <Th col="foreign_ref" label="Внешний ключ" sort={sort} onSort={toggleSort} />
                <Th col="default_value" label="По умолчанию" sort={sort} onSort={toggleSort} />
                <Th col="comment" label="Комментарий" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.schema}.${r.table}.${r.name}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  {!schema && <td className="px-3 py-1 text-[var(--amber)]">{r.schema}</td>}
                  <td className="px-3 py-1 text-[var(--text)]">{r.table}</td>
                  <td className="px-3 py-1 text-[var(--faint)]">{KIND_LABEL[r.table_kind] ?? r.table_kind}</td>
                  <td className="px-3 py-1 font-medium text-[var(--text)]">
                    {r.is_primary && <Badge kind="pk">PK</Badge>}
                    {r.name}
                  </td>
                  <td className="px-3 py-1 text-[var(--violet)]">{r.data_type}</td>
                  <td className="px-3 py-1 text-right text-[var(--faint)]">{r.position}</td>
                  <td className="px-3 py-1 text-[var(--muted)]">{r.is_primary ? '●' : ''}</td>
                  <td className="px-3 py-1 text-[var(--muted)]">{r.not_null ? 'NOT NULL' : <span className="text-[var(--null)]">—</span>}</td>
                  <td className="px-3 py-1 text-[var(--muted)]">
                    {r.foreign_ref ?? <span className="text-[var(--null)]">—</span>}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-1 text-[var(--muted)]">{r.default_value ?? <span className="text-[var(--null)]">—</span>}</td>
                  <td className="max-w-[260px] truncate px-3 py-1 text-[var(--muted)]" title={r.comment ?? undefined}>
                    {r.comment ?? <span className="text-[var(--null)]">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={schema ? 10 : 11} className="px-3 py-3 text-center text-[var(--null)]">
                    {search ? 'Ничего не найдено' : 'Колонок нет'}
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
