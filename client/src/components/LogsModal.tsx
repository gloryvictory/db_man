import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import type { LogRow, AuditEntry } from '../types';
import { Modal, Button, Loader, Tabs } from './ui';

const PAGE_SIZE = 50;

function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function LogsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'queries' | 'actions'>('queries');

  // журнал запросов
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // журнал действий (аудит)
  const [arows, setArows] = useState<AuditEntry[]>([]);
  const [atotal, setAtotal] = useState(0);
  const [apage, setApage] = useState(0);
  const [aloading, setAloading] = useState(false);

  useEffect(() => {
    if (!open || tab !== 'queries') return;
    setLoading(true);
    api
      .logs(PAGE_SIZE, page * PAGE_SIZE)
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, tab, page]);

  useEffect(() => {
    if (!open || tab !== 'actions') return;
    setAloading(true);
    api
      .audit(PAGE_SIZE, apage * PAGE_SIZE)
      .then((r) => {
        setArows(r.rows);
        setAtotal(r.total);
        setAloading(false);
      })
      .catch(() => setAloading(false));
  }, [open, tab, apage]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const apages = Math.max(1, Math.ceil(atotal / PAGE_SIZE));

  async function clearQueries() {
    if (!window.confirm('Очистить весь журнал запросов?')) return;
    try {
      await api.clearLogs();
      toast.success('Журнал запросов очищен');
      const r = await api.logs(PAGE_SIZE, 0);
      setRows(r.rows);
      setTotal(r.total);
      setPage(0);
    } catch {
      toast.error('Не удалось очистить журнал');
    }
  }

  async function clearActions() {
    if (!window.confirm('Очистить журнал действий?')) return;
    try {
      await api.clearAudit();
      toast.success('Журнал действий очищен');
      const r = await api.audit(PAGE_SIZE, 0);
      setArows(r.rows);
      setAtotal(r.total);
      setApage(0);
    } catch {
      toast.error('Не удалось очистить журнал');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Журнал" width={1000}>
      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as 'queries' | 'actions')}
          items={[
            { value: 'queries', label: 'Запросы' },
            { value: 'actions', label: 'Действия' },
          ]}
        />
      </div>

      {tab === 'queries' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => download(api.logsExportUrl('xlsx', { limit: PAGE_SIZE, offset: page * PAGE_SIZE }))}>
              ⭳ Excel · страница
            </Button>
            <Button variant="primary" onClick={() => download(api.logsExportUrl('xlsx'))}>
              ⭳ Excel · весь журнал
            </Button>
            <Button variant="subtle" onClick={() => download(api.logsExportUrl('csv'))}>
              CSV · весь
            </Button>
            <Button variant="subtle" onClick={clearQueries} style={{ color: 'var(--red)' }}>
              <Trash2 size={14} />
              Очистить
            </Button>
            <div className="flex-1" />
            <span className="font-mono text-[12px] text-[var(--muted)]">
              {total.toLocaleString('ru-RU')} записей
            </span>
          </div>

          <div className="max-h-[56vh] overflow-auto rounded-md border border-[var(--border)]">
            {loading ? (
              <div className="grid place-items-center py-16">
                <Loader />
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-[11.5px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--surface)]">
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Время</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Сервер</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-right font-medium text-[var(--muted)]">Порт</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">БД</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Пользователь</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Запрос</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-right font-medium text-[var(--muted)]">Строк</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-right font-medium text-[var(--muted)]">мс</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-[var(--null)]">
                        Записей нет
                      </td>
                    </tr>
                  ) : (
                    rows.map((l) => (
                      <tr key={l.id} className="border-b border-[var(--border)] align-top hover:bg-[var(--surface-hover)]">
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--null)]">{l.created_at}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--text)]" title={l.dsn ?? undefined}>
                          {l.host ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-right text-[var(--text)]">{l.port ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--amber)]">{l.database ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--text)]">{l.username ?? '—'}</td>
                        <td
                          className={`max-w-[340px] truncate px-2 py-1 ${l.error ? 'text-[var(--red)]' : 'text-[var(--text)]'}`}
                          title={(l.error ?? l.query) || undefined}
                        >
                          {l.error ?? l.query}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-right text-[var(--text)]">{l.rows}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right text-[var(--faint)]">
                          {l.duration_ms.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-2 font-mono text-[11.5px] text-[var(--muted)]">
            <span>
              {total ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, total)} из{' '}
              {total.toLocaleString('ru-RU')}
            </span>
            <div className="flex-1" />
            <Button size="xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹
            </Button>
            <span>
              стр. {page + 1} / {pages}
            </span>
            <Button size="xs" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              ›
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="subtle" onClick={clearActions} style={{ color: 'var(--red)' }}>
              <Trash2 size={14} />
              Очистить
            </Button>
            <div className="flex-1" />
            <span className="font-mono text-[12px] text-[var(--muted)]">
              {atotal.toLocaleString('ru-RU')} действий
            </span>
          </div>

          <div className="max-h-[56vh] overflow-auto rounded-md border border-[var(--border)]">
            {aloading ? (
              <div className="grid place-items-center py-16">
                <Loader />
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-[11.5px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--surface)]">
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Время</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Пользователь</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Действие</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Объект</th>
                    <th className="border-b border-[var(--border-strong)] px-2 py-1.5 text-left font-medium text-[var(--muted)]">Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {arows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-[var(--null)]">
                        Действий нет
                      </td>
                    </tr>
                  ) : (
                    arows.map((a) => (
                      <tr key={a.id} className="border-b border-[var(--border)] align-top hover:bg-[var(--surface-hover)]">
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--null)]">{a.created_at}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--text)]">{a.username ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-[var(--text)]">{a.action}</td>
                        <td
                          className={`max-w-[360px] truncate px-2 py-1 ${a.error ? 'text-[var(--red)]' : 'text-[var(--text)]'}`}
                          title={(a.detail ? `${a.target} · ${a.detail}` : a.target) ?? undefined}
                        >
                          {a.target ?? '—'}
                          {a.detail ? <span className="text-[var(--faint)]"> · {a.detail}</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">
                          {a.status === 'ok' ? (
                            <span className="text-[var(--accent)]">ok</span>
                          ) : (
                            <span className="text-[var(--red)]" title={a.error ?? undefined}>
                              ошибка
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-2 font-mono text-[11.5px] text-[var(--muted)]">
            <span>
              {atotal ? apage * PAGE_SIZE + 1 : 0}–{Math.min((apage + 1) * PAGE_SIZE, atotal)} из{' '}
              {atotal.toLocaleString('ru-RU')}
            </span>
            <div className="flex-1" />
            <Button size="xs" disabled={apage === 0} onClick={() => setApage(apage - 1)}>
              ‹
            </Button>
            <span>
              стр. {apage + 1} / {apages}
            </span>
            <Button size="xs" disabled={apage >= apages - 1} onClick={() => setApage(apage + 1)}>
              ›
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
