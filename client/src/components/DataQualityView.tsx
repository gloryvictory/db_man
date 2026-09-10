import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin } from 'lucide-react';
import { api } from '../api';
import { Tabs, Loader } from './ui';
import AnalysisTable, { type AnalysisRow } from './AnalysisTable';
import type { DataQualityResult, SpatialTableRow } from '../types';

export default function DataQualityView({
  id,
  db,
  schema,
  showSchema,
}: {
  id: string;
  db: string;
  schema?: string;
  showSchema: boolean;
}) {
  const [data, setData] = useState<DataQualityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState<'spatial' | 'noIndex'>('spatial');
  const [menu, setMenu] = useState<{ x: number; y: number; schema: string; table: string; geomCols: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = schema ? await api.schemaDataQuality(id, db, schema) : await api.databaseDataQuality(id, db);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, db, schema]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function close() {
      setMenu(null);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('wheel', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('wheel', close);
    };
  }, []);

  async function createSpatialIndex() {
    if (!menu) return;
    const { schema: s, table, geomCols } = menu;
    setMenu(null);
    try {
      for (const col of geomCols) {
        await api.createSpatialIndex(id, db, s, table, col);
      }
      toast.success('Пространственный индекс создан');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  if (loading && !data) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Loader />
      </div>
    );
  }

  const spatial = data?.spatial ?? [];
  const noIndex = data?.noIndex ?? [];
  const prefix = schema ? `${db}_${schema}` : db;

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={sub}
        onChange={(v) => setSub(v as 'spatial' | 'noIndex')}
        items={[
          { value: 'spatial', label: `Пространственные данные (${spatial.length})` },
          { value: 'noIndex', label: `Таблицы без индексов (${noIndex.length})` },
        ]}
      />

      {sub === 'spatial' ? (
        <AnalysisTable
          rows={spatial}
          showSchema={showSchema}
          exportName={`${prefix}_spatial`}
          onRowContextMenu={(row: AnalysisRow, e) => {
            e.preventDefault();
            const geomCols = (row as AnalysisRow & { geom_columns?: string[] }).geom_columns ?? [];
            if (!geomCols.length) return;
            setMenu({ x: e.clientX, y: e.clientY, schema: row.schema ?? schema ?? '', table: row.name, geomCols });
          }}
          extraColumns={[
            {
              key: 'geom',
              label: 'Геометрия',
              value: (r) => (r as SpatialTableRow).geom_columns?.join(', ') ?? null,
            },
          ]}
        />
      ) : (
        <AnalysisTable rows={noIndex} showSchema={showSchema} exportName={`${prefix}_no_index`} />
      )}

      {menu && (
        <div
          className="fixed z-[100] min-w-[230px] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-hover)]"
            onClick={createSpatialIndex}
          >
            <MapPin size={13} className="text-[var(--muted)]" />
            Создать пространственный индекс
          </button>
        </div>
      )}
    </div>
  );
}
