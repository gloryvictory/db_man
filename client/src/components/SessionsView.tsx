import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, Power, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { Tabs, Loader, Button } from './ui';
import { formatDateRel } from '../lib/format';
import type { SessionRow, LockRow } from '../types';

function duration(start: string | null): string {
  if (!start) return '—';
  const ms = Date.now() - new Date(start).getTime();
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин ${s % 60} с`;
  const h = Math.floor(m / 60);
  return `${h} ч ${m % 60} мин`;
}

function truncate(q: string | null): string {
  if (!q) return '';
  return q.length > 100 ? q.slice(0, 100) + '…' : q;
}

export default function SessionsView({ id, db }: { id: string; db: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [sub, setSub] = useState<'sessions' | 'locks'>('sessions');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([api.sessions(id, db), api.locks(id, db)]);
      setSessions(s);
      setLocks(l);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, db]);

  useEffect(() => {
    load();
  }, [load]);

  async function kill(pid: number, mode: 'cancel' | 'terminate') {
    const msg = mode === 'cancel' ? `Отменить запрос бэкенда ${pid}?` : `Завершить сессию (бэкенд) ${pid}?`;
    if (!window.confirm(msg)) return;
    setBusy(pid);
    try {
      if (mode === 'cancel') await api.cancelBackend(id, db, pid);
      else await api.terminateBackend(id, db, pid);
      toast.success(mode === 'cancel' ? 'Запрос отменён' : 'Сессия завершена');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  if (loading && sessions.length === 0 && locks.length === 0) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tabs
          value={sub}
          onChange={(v) => setSub(v as 'sessions' | 'locks')}
          items={[
            { value: 'sessions', label: `Сессии (${sessions.length})` },
            { value: 'locks', label: `Блокировки (${locks.length})` },
          ]}
        />
        <div className="flex-1" />
        <Button size="xs" variant="subtle" onClick={load} disabled={loading}>
          <RefreshCw size={12} />
          Обновить
        </Button>
      </div>

      {sub === 'sessions' ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-[var(--surface)] text-left">
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">PID</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Пользователь</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">БД</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Состояние</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Ожидание</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Запрос</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Длительность</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Клиент</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.pid} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-3 py-1.5 text-[var(--text)]">{s.pid}</td>
                  <td className="px-3 py-1.5 text-[var(--text)]">{s.usename}</td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{s.datname ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <span
                      style={{
                        color: s.state === 'active' ? 'var(--accent)' : s.state === 'idle' ? 'var(--faint)' : 'var(--amber)',
                      }}
                    >
                      {s.state}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[var(--amber)]">
                    {s.wait_event ? `${s.wait_event_type ?? ''}/${s.wait_event}` : '—'}
                  </td>
                  <td className="max-w-[360px] truncate px-3 py-1.5 text-[var(--text)]" title={s.query ?? ''}>
                    {truncate(s.query)}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--text)]">{duration(s.query_start)}</td>
                  <td className="px-3 py-1.5 text-[var(--faint)]">{s.client_addr ?? 'local'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="icon" title="Отменить запрос (pg_cancel_backend)" disabled={busy === s.pid} onClick={() => kill(s.pid, 'cancel')}>
                        <Ban size={13} />
                      </Button>
                      <Button variant="icon" title="Завершить сессию (pg_terminate_backend)" disabled={busy === s.pid} onClick={() => kill(s.pid, 'terminate')}>
                        <Power size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-center text-[var(--null)]">
                    Нет активных сессий
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="bg-[var(--surface)] text-left">
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">PID</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Тип</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Режим</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Статус</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Объект</th>
                <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Ожидание</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((l, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-3 py-1.5 text-[var(--text)]">{l.pid ?? '—'}</td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{l.locktype}</td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{l.mode}</td>
                  <td className="px-3 py-1.5" style={{ color: l.granted ? 'var(--accent)' : 'var(--amber)' }}>
                    {l.granted ? 'granted' : 'waiting'}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--text)]">{l.relation ?? l.transactionid ?? '—'}</td>
                  <td className="px-3 py-1.5 text-[var(--faint)]">{formatDateRel(l.waitstart)}</td>
                </tr>
              ))}
              {locks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-[var(--null)]">
                    Нет блокировок
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
