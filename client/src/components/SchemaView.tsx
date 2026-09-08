import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Tabs, Info } from './ui';
import AnalysisTable from './AnalysisTable';
import type { SchemaInfo, SchemaTableRow } from '../types';

export default function SchemaView() {
  const store = useStore();
  const [info, setInfo] = useState<SchemaInfo | null>(null);
  const [rows, setRows] = useState<SchemaTableRow[]>([]);
  const [view, setView] = useState<'info' | 'analysis'>('info');
  const [loading, setLoading] = useState(false);

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
            <AnalysisTable rows={rows} exportName={`${schema.db}_${schema.schema}_tables`} />
          )}
        </div>
      )}
    </div>
  );
}
