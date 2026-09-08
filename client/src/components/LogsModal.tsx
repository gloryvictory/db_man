import { useEffect, useState } from 'react';
import { Modal, Loader, Center } from '@mantine/core';
import { api } from '../api';
import type { LogRow } from '../types';

export default function LogsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      setLoading(true);
      api
        .logs(200)
        .then(setLogs)
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    }
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Журнал запросов" size="xl" centered>
      {loading ? (
        <Center className="h-40">
          <Loader color="#35c98e" />
        </Center>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse font-mono text-[11.5px]">
            <thead>
              <tr>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left text-[#8b93a7]">Время</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left text-[#8b93a7]">БД</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-left text-[#8b93a7]">Запрос</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-right text-[#8b93a7]">Строк</th>
                <th className="border-b border-[#333a4a] px-2 py-1.5 text-right text-[#8b93a7]">мс</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-[#6b7390]">
                    Записей нет
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-[#272c39] align-top">
                    <td className="whitespace-nowrap px-2 py-1 text-[#6b7390]">{l.created_at}</td>
                    <td className="whitespace-nowrap px-2 py-1">{l.database ?? '—'}</td>
                    <td className={`break-all px-2 py-1 ${l.error ? 'text-[#e06c6c]' : 'text-[#e7eaf0]'}`}>
                      {l.error ? l.error : l.query}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">{l.rows}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right text-[#5c6478]">
                      {l.duration_ms.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
