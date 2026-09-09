import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Power, List, BarChart3, Database, Moon, Sun } from 'lucide-react';
import { useStore } from '../store';
import { getTheme, applyTheme, type Theme } from '../lib/theme';
import { Button, Select } from './ui';
import ConnectionModal from './ConnectionModal';
import LogsModal from './LogsModal';
import ObjectSearch from './ObjectSearch';
import PasswordModal from './PasswordModal';

export default function Topbar() {
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [connOpen, setConnOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());

  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }

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

      <ObjectSearch />

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

      <ConnectionModal open={connOpen} onClose={() => setConnOpen(false)} />
      <LogsModal open={logsOpen} onClose={() => setLogsOpen(false)} />
      <PasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </header>
  );
}
