import { useRef, useState } from 'react';
import { Play, History, Trash2, Clock } from 'lucide-react';
import { api } from '../api';
import { Button, Loader } from './ui';
import type { QueryResult } from '../types';

const MAX_ROWS = 1000;
const HISTORY_KEY = 'dbman-sql-history';
const HISTORY_MAX = 50;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isDangerous(sql: string): boolean {
  return /\b(DROP|TRUNCATE)\b/i.test(sql);
}

export default function SqlConsole({ id, db }: { id: string; db: string }) {
  const [sql, setSql] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function run(text?: string) {
    const q = (text ?? sql).trim();
    if (!q) return;
    if (isDangerous(q) && !window.confirm('Запрос содержит DROP/TRUNCATE. Выполнить?')) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.runQuery(id, db, q);
      setResult(r);
      setHistory((h) => {
        const next = [q, ...h.filter((x) => x !== q)].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setRunning(false);
    }
  }

  function onKeydown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  }

  const truncated = result ? result.rows.length > MAX_ROWS : false;
  const shownRows = result ? result.rows.slice(0, MAX_ROWS) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => run()} disabled={running || !sql.trim()}>
          <Play size={14} />
          {running ? 'Выполнение…' : 'Выполнить'}
        </Button>
        <span className="text-[11px] text-[var(--faint)]">Ctrl+Enter</span>
        <div className="flex-1" />
        <div className="relative">
          <Button variant="subtle" onClick={() => setHistoryOpen((o) => !o)} disabled={!history.length}>
            <History size={14} />
            История
          </Button>
          {historyOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setHistoryOpen(false)} />
              <div className="absolute right-0 top-full z-30 mt-1 max-h-80 w-[440px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-raised)] shadow-xl">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="flex cursor-pointer items-start gap-2 border-b border-[var(--border)] px-3 py-2 text-[12px] font-mono last:border-b-0 hover:bg-[var(--bg-panel)]"
                    onClick={() => {
                      setSql(h);
                      setHistoryOpen(false);
                      taRef.current?.focus();
                    }}
                  >
                    <Clock size={12} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                    <span className="whitespace-pre-wrap break-all">{h}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {history.length > 0 && (
          <Button
            variant="icon"
            title="Очистить историю"
            onClick={() => {
              setHistory([]);
              saveHistory([]);
            }}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      <textarea
        ref={taRef}
        className="min-h-[120px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-3 font-mono text-[12.5px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
        placeholder={`SELECT …\n\nЗапрос выполняется в базе «${db}»`}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onKeydown}
        spellCheck={false}
      />

      {running ? (
        <div className="grid h-20 place-items-center">
          <Loader />
        </div>
      ) : error ? (
        <div className="whitespace-pre-wrap rounded-md border border-[var(--red)] p-3 font-mono text-[12px] text-[var(--red)]">
          {error}
        </div>
      ) : result ? (
        result.columns.length > 0 ? (
          <div className="flex min-h-0 flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span>{result.rows.length.toLocaleString('ru-RU')} строк</span>
              <span>·</span>
              <span>{result.duration_ms} мс</span>
              {truncated && <span className="text-[var(--amber)]">показаны первые {MAX_ROWS}</span>}
            </div>
            <div className="min-h-0 overflow-auto rounded-lg border border-[var(--border)]">
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-[var(--surface)] text-left">
                    <th className="sticky left-0 border-b border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-right text-[var(--faint)]">
                      #
                    </th>
                    {result.columns.map((c, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-b border-[var(--border-strong)] px-3 py-1.5 font-medium text-[var(--muted)]"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="sticky left-0 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-right text-[var(--faint)]">
                        {ri + 1}
                      </td>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="max-w-[320px] truncate px-3 py-1 text-[var(--text)]"
                          title={formatCell(cell)}
                        >
                          {cell === null || cell === undefined ? (
                            <span className="text-[var(--null)]">NULL</span>
                          ) : (
                            formatCell(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-3 text-[13px]">
            <span className="font-mono text-[var(--accent)]">{result.command || 'OK'}</span>
            <span className="text-[var(--muted)]"> — затронуто строк: </span>
            <span className="font-mono">{result.rowCount.toLocaleString('ru-RU')}</span>
            <span className="text-[var(--muted)]"> · {result.duration_ms} мс</span>
          </div>
        )
      ) : null}
    </div>
  );
}
