import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Table, Columns, Key } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import type { SearchResult } from '../types';
import { Loader } from './ui';

export default function ObjectSearch() {
  const store = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentDb = store.selected?.db ?? store.selectedDb ?? store.selectedSchema?.db;
  const enabled = !!store.connected && !!store.activeConnId && !!currentDb;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setResult(null);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const query = q.trim();
      if (query.length < 2) {
        setResult(null);
        return;
      }
      setLoading(true);
      try {
        const r = await api.search(store.activeConnId!, currentDb!, query);
        setResult(r);
        setOpen(true);
      } catch {
        setResult(null);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, enabled, currentDb, store.activeConnId]);

  function gotoTable(schema: string, table: string) {
    setOpen(false);
    setQ('');
    setResult(null);
    store.selectTable(currentDb!, schema, table);
    navigate('/');
  }

  const total = result ? result.tables.length + result.columns.length + result.indexes.length : 0;

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex h-[30px] w-[230px] items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 ${
          enabled ? '' : 'opacity-60'
        }`}
      >
        <Search size={13} className="shrink-0 text-[var(--muted)]" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
          placeholder={enabled ? 'Поиск объектов…' : 'Выберите БД'}
          value={q}
          disabled={!enabled}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && <Loader size={12} />}
      </div>

      {open && result && (
        <div className="search-menu">
          {total === 0 && <div className="px-2 py-2 text-[12px] text-[var(--faint)]">Ничего не найдено</div>}

          {result.tables.length > 0 && (
            <>
              <div className="search-group-title">Таблицы</div>
              {result.tables.map((t) => (
                <div key={`t:${t.schema}.${t.name}`} className="search-item" onClick={() => gotoTable(t.schema, t.name)}>
                  <Table size={13} />
                  <span className="whitespace-nowrap font-mono">
                    {t.schema}.{t.name}
                  </span>
                  {t.comment && <span className="min-w-0 flex-1 truncate text-[var(--faint)]">{t.comment}</span>}
                </div>
              ))}
            </>
          )}

          {result.columns.length > 0 && (
            <>
              <div className="search-group-title">Колонки</div>
              {result.columns.map((c) => (
                <div
                  key={`c:${c.schema}.${c.table}.${c.name}`}
                  className="search-item"
                  onClick={() => gotoTable(c.schema, c.table)}
                >
                  <Columns size={13} />
                  <span className="whitespace-nowrap font-mono">
                    {c.schema}.{c.table}.{c.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--faint)]">{c.data_type}</span>
                </div>
              ))}
            </>
          )}

          {result.indexes.length > 0 && (
            <>
              <div className="search-group-title">Индексы</div>
              {result.indexes.map((i) => (
                <div key={`i:${i.schema}.${i.name}`} className="search-item" onClick={() => gotoTable(i.schema, i.table)}>
                  <Key size={13} />
                  <span className="whitespace-nowrap font-mono">
                    {i.schema}.{i.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--faint)]">{i.table}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
