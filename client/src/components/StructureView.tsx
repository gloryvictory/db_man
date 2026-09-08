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
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#8b93a7]">Колонки</h2>
        <span className="font-mono text-[11px] text-[#5c6478]">{store.columns.length}</span>
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={doExport}>
          <Download size={12} />
          Экспорт
        </Button>
      </div>

      <table className="w-full border-collapse font-mono text-[12px]">
        <thead>
          <tr>
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]" />
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]">
              Столбец
            </th>
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]">
              Тип
            </th>
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]">
              Null
            </th>
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]">
              Default
            </th>
            <th className="border-b border-[#333a4a] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#8b93a7]">
              Ссылка (FK)
            </th>
          </tr>
        </thead>
        <tbody>
          {store.columns.map((c) => (
            <tr key={c.name} className="border-b border-[#272c39]">
              <td className="px-3 py-1.5">
                {c.is_primary ? (
                  <span className="rounded bg-[#0f2b21] px-1 text-[9px] font-bold text-[#35c98e]">PK</span>
                ) : c.foreign_ref ? (
                  <span className="rounded bg-[#16283b] px-1 text-[9px] font-bold text-[#5aa7e8]">FK</span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-[#e7eaf0]">{c.name}</td>
              <td className="px-3 py-1.5 text-[#7fd4ff]">{c.data_type}</td>
              <td className="px-3 py-1.5">
                {c.not_null ? (
                  <span className="text-[#35c98e]">NOT NULL</span>
                ) : (
                  <span className="italic text-[#6b7390]">NULL</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-[#e7eaf0]">
                {c.default_value ?? <span className="text-[#6b7390]">—</span>}
              </td>
              <td className="px-3 py-1.5 text-[#e7eaf0]">
                {c.foreign_ref ?? <span className="text-[#6b7390]">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
