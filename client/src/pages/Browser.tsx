import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import DataView from '../components/DataView';
import StructureView from '../components/StructureView';
import SqlView from '../components/SqlView';
import ServiceView from '../components/ServiceView';
import DatabaseView from '../components/DatabaseView';
import SchemaView from '../components/SchemaView';
import { useStore } from '../store';
import { api } from '../api';
import { Button, Input, Tabs, Badge } from '../components/ui';

function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 640;
const SIDEBAR_DEFAULT = 280;

export default function Browser() {
  const store = useStore();
  const [filterLocal, setFilterLocal] = useState('');
  const [sidebarW, setSidebarW] = useState<number>(() => {
    const saved = Number(localStorage.getItem('dbman-sidebar-width'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : SIDEBAR_DEFAULT;
  });
  const drag = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, drag.current.w + (e.clientX - drag.current.x)));
      setSidebarW(w);
    }
    function onUp() {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dbman-sidebar-width', String(sidebarW));
  }, [sidebarW]);

  function startDrag(e: React.MouseEvent) {
    drag.current = { x: e.clientX, w: sidebarW };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }

  useEffect(() => {
    setFilterLocal('');
  }, [store.selected]);

  useEffect(() => {
    const t = setTimeout(() => store.setFilter(filterLocal), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLocal]);

  function doExport(format: 'xlsx' | 'csv' | 'sql') {
    const id = store.activeConnId;
    const sel = store.selected;
    if (!id || !sel) return;
    download(api.exportUrl(id, sel.db, sel.schema, sel.table, format));
  }

  const sel = store.selected;

  return (
    <div className="flex h-full">
      <Sidebar width={sidebarW} />
      <div
        className="group relative w-[5px] shrink-0 cursor-col-resize transition-colors hover:bg-[var(--accent-bg)]"
        onMouseDown={startDrag}
        title="Перетащите, чтобы изменить ширину"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border)] transition-colors group-hover:bg-[var(--accent)]" />
      </div>
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
        {store.selectedDb && !sel ? (
          <DatabaseView key={store.selectedDb} />
        ) : store.selectedSchema && !sel ? (
          <SchemaView key={`${store.selectedSchema.db}.${store.selectedSchema.schema}`} />
        ) : !sel ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--faint)]">
            Выберите таблицу слева
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h1 className="font-mono text-[16px] font-semibold">{sel.table}</h1>
                <span className="font-mono text-[12px] text-[var(--amber)]">{sel.schema}.</span>
                <span className="text-[12px] text-[var(--muted)]">
                  <b className="text-[var(--text)]">{store.columns.length}</b> столбцов ·{' '}
                  <b className="text-[var(--text)]">{store.total.toLocaleString('ru-RU')}</b> строк ·{' '}
                  <b className="text-[var(--text)]">{sel.db}</b>
                </span>
                {store.loadingTable && <Badge kind="kind">загрузка…</Badge>}
              </div>
              <div className="mt-3">
                <Tabs
                  value={store.view}
                  onChange={(v) => store.setView(v as 'data' | 'structure' | 'sql' | 'service')}
                  items={[
                    { value: 'data', label: 'Данные' },
                    { value: 'structure', label: 'Структура' },
                    { value: 'sql', label: 'SQL' },
                    { value: 'service', label: 'Сервис' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2">
              <Button onClick={() => store.fetchRows()}>
                <RefreshCw size={14} />
                Обновить
              </Button>
              <div className="w-[220px]">
                <Input
                  placeholder="Фильтр по значению…"
                  value={filterLocal}
                  onChange={(e) => setFilterLocal(e.target.value)}
                />
              </div>
              <div className="flex-1" />
              <Button onClick={() => doExport('xlsx')}>
                <Download size={14} />
                Excel
              </Button>
              <Button variant="subtle" onClick={() => doExport('csv')}>
                CSV
              </Button>
              <Button variant="subtle" onClick={() => doExport('sql')}>
                INSERT
              </Button>
            </div>

            {store.view === 'data' && <DataView />}
            {store.view === 'structure' && <StructureView />}
            {store.view === 'sql' && <SqlView />}
            {store.view === 'service' && <ServiceView />}

            <div className="flex h-[26px] items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-raised)] px-3 font-mono text-[11.5px] text-[var(--muted)]">
              <span className="text-[var(--accent)]">●</span>
              <span>{store.connections.find((c) => c.id === store.activeConnId)?.host ?? ''}</span>
              <span>
                {sel.db}.{sel.schema}.{sel.table}
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
