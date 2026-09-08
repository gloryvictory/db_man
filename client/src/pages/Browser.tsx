import { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import DataView from '../components/DataView';
import StructureView from '../components/StructureView';
import SqlView from '../components/SqlView';
import ServiceView from '../components/ServiceView';
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

export default function Browser() {
  const store = useStore();
  const [filterLocal, setFilterLocal] = useState('');

  useEffect(() => {
    setFilterLocal('');
  }, [store.selected]);

  useEffect(() => {
    const t = setTimeout(() => store.setFilter(filterLocal), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLocal]);

  function doExport(format: 'xlsx' | 'csv') {
    const id = store.activeConnId;
    const sel = store.selected;
    if (!id || !sel) return;
    download(api.exportUrl(id, sel.db, sel.schema, sel.table, format));
  }

  const sel = store.selected;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-[#0e1015]">
        {!sel ? (
          <div className="flex h-full items-center justify-center text-sm text-[#5c6478]">
            Выберите таблицу слева
          </div>
        ) : (
          <>
            <div className="border-b border-[#272c39] px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h1 className="font-mono text-[16px] font-semibold">{sel.table}</h1>
                <span className="font-mono text-[12px] text-[#e0a94f]">{sel.schema}.</span>
                <span className="text-[12px] text-[#8b93a7]">
                  <b className="text-[#e7eaf0]">{store.columns.length}</b> столбцов ·{' '}
                  <b className="text-[#e7eaf0]">{store.total.toLocaleString('ru-RU')}</b> строк ·{' '}
                  <b className="text-[#e7eaf0]">{sel.db}</b>
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

            <div className="flex items-center gap-3 border-b border-[#272c39] px-4 py-2">
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
            </div>

            {store.view === 'data' && <DataView />}
            {store.view === 'structure' && <StructureView />}
            {store.view === 'sql' && <SqlView />}
            {store.view === 'service' && <ServiceView />}

            <div className="flex h-[26px] items-center gap-3 border-t border-[#272c39] bg-[#151820] px-3 font-mono text-[11.5px] text-[#8b93a7]">
              <span className="text-[#35c98e]">●</span>
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
