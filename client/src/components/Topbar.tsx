import { Select, Button, Indicator, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Power, List, BarChart3, Database } from 'lucide-react';
import { useStore } from '../store';
import ConnectionModal from './ConnectionModal';
import LogsModal from './LogsModal';
import PasswordModal from './PasswordModal';

export default function Topbar() {
  const store = useStore();
  const location = useLocation();
  const [connOpen, connHandlers] = useDisclosure(false);
  const [logsOpen, logsHandlers] = useDisclosure(false);
  const [pwdOpen, pwdHandlers] = useDisclosure(false);

  const options = store.connections.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.host}:${c.port})`,
  }));

  async function onSelectConn(id: string | null) {
    if (!id) return;
    store.setActiveConn(id);
    const ok = await store.connect(id);
    if (!ok) pwdHandlers.open();
  }

  const navBtn = (active: boolean) => (active ? 'light' : 'subtle');

  return (
    <header className="flex h-[46px] items-center gap-3 border-b border-[#272c39] bg-[#151820] px-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-[#35c98e] to-[#1c6e51] font-mono text-xs font-bold text-[#06130e]">
          ▣
        </span>
        <span>db_man</span>
      </div>

      <div className="h-[22px] w-px bg-[#272c39]" />

      <div className="flex items-center gap-2">
        <Indicator
          color={store.connected ? '#35c98e' : '#5c6478'}
          size={8}
          offset={6}
          processing={store.connecting}
        >
          <Select
            w={240}
            size="xs"
            placeholder="Выберите подключение"
            data={options}
            value={store.activeConnId}
            onChange={onSelectConn}
            clearable
            onClear={() => store.setActiveConn(null)}
            searchable
          />
        </Indicator>
        {store.activeConnId &&
          (store.connected ? (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              title="Отключиться"
              onClick={() => store.disconnect()}
            >
              <Power size={15} />
            </ActionIcon>
          ) : (
            <Button size="xs" variant="light" onClick={() => onSelectConn(store.activeConnId!)}>
              Подключить
            </Button>
          ))}
      </div>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        <Button
          size="xs"
          variant={navBtn(location.pathname === '/')}
          component={Link}
          to="/"
          leftSection={<Database size={14} />}
        >
          Браузер
        </Button>
        <Button
          size="xs"
          variant={navBtn(location.pathname === '/overview')}
          component={Link}
          to="/overview"
          leftSection={<BarChart3 size={14} />}
        >
          Обзор
        </Button>
      </nav>

      <Button size="xs" variant="subtle" onClick={logsHandlers.open} leftSection={<List size={14} />}>
        Журнал
      </Button>
      <Button size="xs" variant="filled" onClick={connHandlers.open} leftSection={<Plus size={14} />}>
        Подключение
      </Button>

      <ConnectionModal opened={connOpen} onClose={connHandlers.close} />
      <LogsModal opened={logsOpen} onClose={logsHandlers.close} />
      <PasswordModal opened={pwdOpen} onClose={pwdHandlers.close} />
    </header>
  );
}
