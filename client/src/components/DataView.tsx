import { useEffect, useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import { useStore } from '../store';
import { formatValue } from '../lib/format';
import { Loader, Button, Badge, Select } from './ui';
import type { ColumnMeta } from '../types';

const columnHelper = createColumnHelper<Record<string, unknown>>();

function HeaderCell({ col }: { col: ColumnMeta }) {
  const store = useStore();
  const sorted = store.sort?.col === col.name;
  return (
    <span>
      {col.is_primary && <Badge kind="pk">PK</Badge>}
      {col.foreign_ref && !col.is_primary && <Badge kind="fk">FK</Badge>}
      {col.name}
      {sorted && <span className="ml-1 text-[var(--accent)]">{store.sort!.dir === 'asc' ? '▲' : '▼'}</span>}
      <span className="block text-[10px] font-normal text-[var(--faint)]">{col.data_type}</span>
    </span>
  );
}

function CellValue({ v }: { v: unknown }) {
  const { text, kind } = formatValue(v);
  const cls =
    kind === 'null'
      ? 'italic text-[var(--null)]'
      : kind === 'bool'
        ? text === 'true'
          ? 'text-[var(--accent)]'
          : 'text-[var(--faint)]'
        : kind === 'number'
          ? 'text-[var(--violet)]'
          : kind === 'json'
            ? 'text-[var(--violet)]'
            : 'text-[var(--text)]';
  return <span className={cls}>{text}</span>;
}

export default function DataView() {
  const store = useStore();

  const data = useMemo(() => {
    return store.rows.map((r) => {
      const obj: Record<string, unknown> = {};
      store.columns.forEach((c, i) => {
        obj[c.name] = r[i];
      });
      return obj;
    });
  }, [store.rows, store.columns]);

  const columns = useMemo(
    () =>
      store.columns.map((c) =>
        columnHelper.accessor(c.name, {
          id: c.name,
          header: () => <HeaderCell col={c} />,
          cell: (info) => <CellValue v={info.getValue()} />,
        })
      ),
    [store.columns]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination: { pageIndex: store.page, pageSize: store.pageSize } },
    pageCount: Math.max(1, Math.ceil(store.total / store.pageSize)),
  });

  useEffect(() => {
    if (store.selected) store.fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.selected, store.page, store.pageSize, store.sort, store.filter]);

  const pageCount = Math.max(1, Math.ceil(store.total / store.pageSize));

  if (store.loadingTable && (store.rows.length === 0 || store.columns.length === 0)) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse font-mono text-[12px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th className="sticky left-0 z-10 min-w-[44px] border-b border-r border-[var(--border-strong)] bg-[var(--surface)] px-2 text-right font-normal text-[var(--faint)]">
                  #
                </th>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={() => store.setSort(h.column.id)}
                    className="sticky top-0 cursor-pointer select-none whitespace-nowrap border-b border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-left font-medium text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={store.columns.length + 1}
                  className="border-b border-[var(--border)] px-3 py-4 text-center text-[var(--null)]"
                >
                  Нет строк
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-hover)]">
                  <td className="sticky left-0 z-10 border-b border-r border-[var(--border)] bg-[var(--bg-panel)] px-2 text-right text-[var(--faint)]">
                    {store.page * store.pageSize + row.index + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap border-b border-[var(--border)] px-3 py-1"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-raised)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--muted)]">
        <span>
          {store.total ? store.page * store.pageSize + 1 : 0}–
          {Math.min((store.page + 1) * store.pageSize, store.total)} из{' '}
          {store.total.toLocaleString('ru-RU')}
        </span>
        <div className="flex-1" />
        <span className="text-[var(--faint)]">LIMIT</span>
        <Select
          direction="up"
          width={68}
          value={String(store.pageSize)}
          onChange={(v) => store.setPageSize(Number(v))}
          options={['10', '25', '50', '100'].map((n) => ({ value: n, label: n }))}
        />
        <Button size="xs" disabled={store.page === 0} onClick={() => store.setPage(store.page - 1)}>
          ‹
        </Button>
        <span>
          стр. {store.page + 1} / {pageCount}
        </span>
        <Button
          size="xs"
          disabled={store.page >= pageCount - 1}
          onClick={() => store.setPage(store.page + 1)}
        >
          ›
        </Button>
      </div>
    </div>
  );
}
