import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Power, List, BarChart3, Database, Moon, Sun, User, ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { getTheme, applyTheme, type Theme } from '../lib/theme';
import { Button, Select } from './ui';
import ConnectionModal from './ConnectionModal';
import LogsModal from './LogsModal';
import PasswordModal from './PasswordModal';
import AdminPanel from './AdminPanel';
import { useAuth } from '../store/authStore';

export default function Topbar() {
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [connOpen, setConnOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const auth = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }

  // автоподключение к последней конфигурации при открытии приложения
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useStore.getState().loadConnections();
      const id = localStorage.getItem('dbman-last-conn');
      if (cancelled || !id) return;
      const exists = useStore.getState().connections.some((c) => c.id === id);
      if (!exists) return;
      useStore.getState().setActiveConn(id);
      const ok = await useStore.getState().connect(id);
      if (!ok && !cancelled) setPwdOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = store.connections.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.host}:${c.port})`,
  }));

  async function onSelectConn(id: string | null) {
    if (!id) return;
    store.setActiveConn(id);
    const ok = await store.connect(id);
    if (!ok) setPwdOpen(true);
  }

  const dot = store.connecting ? 'processing' : store.connected ? 'green' : 'gray';

  return (
    <header className="flex h-[46px] items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-raised)] px-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] font-mono text-xs font-bold text-[var(--accent-fg)]">
          ▣
        </span>
        <span>db_man</span>
      </div>

      <div className="h-[22px] w-px bg-[var(--border)]" />

      <Select
        width={250}
        value={store.activeConnId}
        onChange={onSelectConn}
        options={options}
        placeholder="Выберите подключение"
        searchable
        dot={dot}
      />
      {store.activeConnId &&
        (store.connected ? (
          <Button variant="icon" title="Отключиться" onClick={() => store.disconnect()}>
            <Power size={15} />
          </Button>
        ) : (
          <Button variant="light" onClick={() => onSelectConn(store.activeConnId!)}>
            Подключить
          </Button>
        ))}

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        <Button
          variant={location.pathname === '/' ? 'light' : 'subtle'}
          onClick={() => navigate('/')}
        >
          <Database size={14} />
          Браузер
        </Button>
        <Button
          variant={location.pathname === '/overview' ? 'light' : 'subtle'}
          onClick={() => navigate('/overview')}
        >
          <BarChart3 size={14} />
          Обзор
        </Button>
      </nav>

      <Button variant="subtle" onClick={() => setLogsOpen(true)}>
        <List size={14} />
        Журнал
      </Button>
      <Button variant="primary" onClick={() => setConnOpen(true)}>
        <Plus size={14} />
        Подключение
      </Button>
      <Button
        variant="icon"
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </Button>

      <div className="relative">
        <Button variant="subtle" onClick={() => setUserOpen((o) => !o)} title={auth.user?.fio}>
          <User size={14} />
          <span className="max-w-[140px] truncate">{auth.user?.login}</span>
          <ChevronDown size={12} />
        </Button>
        {userOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setUserOpen(false)} />
            <div className="absolute right-0 top-full z-30 mt-1 w-[230px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-raised)] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{auth.user?.fio}</div>
                  <div className="truncate font-mono text-[11px] text-[var(--muted)]">{auth.user?.login}</div>
                </div>
                {auth.user?.role === 'admin' && (
                  <span className="ml-2 shrink-0 rounded bg-[var(--accent-bg-hover)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    админ
                  </span>
                )}
              </div>
              {auth.user?.role === 'admin' && (
                <div
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg-panel)]"
                  onClick={() => {
                    setUserOpen(false);
                    setAdminOpen(true);
                  }}
                >
                  <ShieldCheck size={14} />
                  Админка
                </div>
              )}
              <div
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg-panel)]"
                onClick={() => {
                  setUserOpen(false);
                  auth.logout();
                }}
              >
                <LogOut size={14} />
                Выйти
              </div>
            </div>
          </>
        )}
      </div>

      <ConnectionModal open={connOpen} onClose={() => setConnOpen(false)} />
      <LogsModal open={logsOpen} onClose={() => setLogsOpen(false)} />
      <PasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </header>
  );
}
