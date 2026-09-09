import { Download } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui';
import { exportToExcel } from '../lib/export';

export default function StructureView() {
  const store = useStore();

  function doExport() {
    const header = ['Столбец', 'Тип', 'NOT NULL', 'Default', 'Ключ', 'Ссылка (FK)'];
    const data = store.columns.map((c) => [
      c.name,
      c.data_type,
      c.not_null ? 'NOT NULL' : '',
      c.default_value ?? '',
      c.is_primary ? 'PK' : c.foreign_ref ? 'FK' : '',
      c.foreign_ref ?? '',
    ]);
    exportToExcel(`${store.selected?.table ?? 'table'}_columns`, header, data);
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Колонки</h2>
        <span className="font-mono text-[11px] text-[var(--faint)]">{store.columns.length}</span>
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={doExport}>
          <Download size={12} />
          Экспорт
        </Button>
      </div>

      <table className="w-full border-collapse font-mono text-[12px]">
        <thead>
          <tr>
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]" />
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Столбец
            </th>
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Тип
            </th>
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Null
            </th>
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Default
            </th>
            <th className="border-b border-[var(--border-strong)] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Ссылка (FK)
            </th>
          </tr>
        </thead>
        <tbody>
          {store.columns.map((c) => (
            <tr key={c.name} className="border-b border-[var(--border)]">
              <td className="px-3 py-1.5">
                {c.is_primary ? (
                  <span className="rounded bg-[var(--accent-bg)] px-1 text-[9px] font-bold text-[var(--accent)]">PK</span>
                ) : c.foreign_ref ? (
                  <span className="rounded bg-[var(--blue-bg)] px-1 text-[9px] font-bold text-[var(--blue)]">FK</span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-[var(--text)]">{c.name}</td>
              <td className="px-3 py-1.5 text-[var(--cyan)]">{c.data_type}</td>
              <td className="px-3 py-1.5">
                {c.not_null ? (
                  <span className="text-[var(--accent)]">NOT NULL</span>
                ) : (
                  <span className="italic text-[var(--null)]">NULL</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-[var(--text)]">
                {c.default_value ?? <span className="text-[var(--null)]">—</span>}
              </td>
              <td className="px-3 py-1.5 text-[var(--text)]">
                {c.foreign_ref ?? <span className="text-[var(--null)]">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
