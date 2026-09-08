import { useEffect, useState } from 'react';
import { api } from '../api';
import type { LogRow } from '../types';
import { Modal, Button, Loader } from './ui';

const PAGE_SIZE = 50;

function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function LogsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .logs(PAGE_SIZE, page * PAGE_SIZE)
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal open={open} onClose={onClose} title="Журнал запросов" width={1000}>
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
        <div className="flex-1" />
        <span className="font-mono text-[12px] text-[#8b93a7]">
          {total.toLocaleString('ru-RU')} записей
        </span>
      </div>

      <div className="max-h-[58vh] overflow-auto rounded-md border border-[#272c39]">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader />
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[11.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#181c26]">
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left font-medium text-[#8b93a7]">Время</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left font-medium text-[#8b93a7]">Сервер</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-right font-medium text-[#8b93a7]">Порт</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left font-medium text-[#8b93a7]">БД</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left font-medium text-[#8b93a7]">Пользователь</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left font-medium text-[#8b93a7]">Запрос</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-right font-medium text-[#8b93a7]">Строк</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-right font-medium text-[#8b93a7]">мс</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-[#6b7390]">
                    Записей нет
                  </td>
                </tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} className="border-b border-[#272c39] align-top hover:bg-[#1e2330]">
                    <td className="whitespace-nowrap px-2 py-1 text-[#6b7390]">{l.created_at}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-[#e7eaf0]" title={l.dsn ?? undefined}>
                      {l.host ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right text-[#e7eaf0]">{l.port ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-[#e0a94f]">{l.database ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-[#e7eaf0]">{l.username ?? '—'}</td>
                    <td
                      className={`max-w-[340px] truncate px-2 py-1 ${l.error ? 'text-[#e06c6c]' : 'text-[#e7eaf0]'}`}
                      title={(l.error ?? l.query) || undefined}
                    >
                      {l.error ?? l.query}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right text-[#e7eaf0]">{l.rows}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right text-[#5c6478]">
                      {l.duration_ms.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-[#272c39] pt-2 font-mono text-[11.5px] text-[#8b93a7]">
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
    </Modal>
  );
}
