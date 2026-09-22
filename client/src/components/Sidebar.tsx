import { useEffect, useState } from 'react';
import { ChevronRight, Server, Database, Layers, Table, Pencil } from 'lucide-react';
import { useStore, type TreeNode } from '../store';
import { Loader } from './ui';
import ObjectSearch from './ObjectSearch';
import RenameDatabaseModal from './RenameDatabaseModal';

function iconFor(kind: TreeNode['kind']) {
  switch (kind) {
    case 'conn':
      return <Server size={13} className="text-[var(--accent)]" />;
    case 'db':
      return <Database size={13} className="text-[var(--blue)]" />;
    case 'schema':
      return <Layers size={13} className="text-[var(--amber)]" />;
    default:
      return <Table size={13} className="text-[var(--muted)]" />;
  }
}

function NodeRow({
  node,
  depth,
  onDbContextMenu,
}: {
  node: TreeNode;
  depth: number;
  onDbContextMenu?: (db: string, e: React.MouseEvent) => void;
}) {
  const store = useStore();
  const expanded = !!store.expanded[node.id];
  const loading = !!store.loadingNodes[node.id];
  const children = store.children[node.id];
  const hasChildren = node.kind !== 'table';
  const selected =
    (node.kind === 'table' &&
      store.selected?.table === node.table &&
      store.selected?.schema === node.schema &&
      store.selected?.db === node.db) ||
    (node.kind === 'db' && store.selectedDb === node.db) ||
    (node.kind === 'schema' &&
      store.selectedSchema?.schema === node.schema &&
      store.selectedSchema?.db === node.db);

  return (
    <div>
      <div
        className={`flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[12.5px] hover:bg-[var(--surface-hover)] ${
          selected ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'text-[var(--text)]'
        }`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => {
          if (node.kind === 'table') store.selectTable(node.db!, node.schema!, node.table!);
          else if (node.kind === 'db') {
            store.toggleNode(node);
            store.selectDatabase(node.db!);
          } else if (node.kind === 'schema') {
            store.toggleNode(node);
            store.selectSchema(node.db!, node.schema!);
          } else store.toggleNode(node);
        }}
        onContextMenu={
          node.kind === 'db' && onDbContextMenu
            ? (e) => {
                e.preventDefault();
                onDbContextMenu(node.db!, e);
              }
            : undefined
        }
      >
        <span
          className={`flex w-3 shrink-0 items-center justify-center text-[9px] text-[var(--faint)] transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          {hasChildren && (loading ? <Loader size={10} /> : <ChevronRight size={10} />)}
        </span>
        <span className="flex w-4 shrink-0 justify-center">{iconFor(node.kind)}</span>
        <span className={`truncate ${node.kind === 'table' || node.kind === 'db' ? 'font-mono' : ''}`}>
          {node.label}
        </span>
        {node.kind === 'table' && (
          <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-[var(--faint)]">
            {node.rowEstimate != null ? node.rowEstimate.toLocaleString('ru-RU') : ''}
          </span>
        )}
        {node.kind === 'table' && node.tableKind && node.tableKind !== 'table' && (
          <span className="ml-1 shrink-0 rounded bg-[var(--surface-elevated)] px-1 font-mono text-[9px] text-[var(--muted)]">
            {node.tableKind}
          </span>
        )}
      </div>

      {expanded && children && (
        <div className="ml-[13px] border-l border-[var(--border)]">
          {children.map((c) => (
            <NodeRow key={c.id} node={c} depth={depth + 1} onDbContextMenu={onDbContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ width }: { width: number }) {
  const store = useStore();
  const [menu, setMenu] = useState<{ x: number; y: number; db: string } | null>(null);
  const [renameDb, setRenameDb] = useState<string | null>(null);

  useEffect(() => {
    store.loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function close() {
      setMenu(null);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('wheel', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('wheel', close);
    };
  }, []);

  const conn = store.connections.find((c) => c.id === store.activeConnId);

  function onDbContextMenu(db: string, e: React.MouseEvent) {
    setMenu({ x: e.clientX, y: e.clientY, db });
  }

  return (
    <aside className="flex shrink-0 flex-col bg-[var(--bg-panel)]" style={{ width }}>
      <div className="border-b border-[var(--border)] p-2">
        <ObjectSearch />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!store.activeConnId || !conn ? (
          <div className="px-2 py-1 text-[12px] text-[var(--faint)]">
            Добавьте подключение, чтобы начать работу.
          </div>
        ) : (
          <>
            <NodeRow
              node={{
                id: conn.id,
                label: `${conn.name} · ${conn.host}:${conn.port}`,
                kind: 'conn',
                connId: conn.id,
              }}
              depth={0}
              onDbContextMenu={onDbContextMenu}
            />
            {!store.connected && (
              <div className="px-6 py-1 text-[12px] text-[var(--faint)]">
                Не подключено — нажмите «Подключить».
              </div>
            )}
          </>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-[100] min-w-[180px] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-hover)]"
            onClick={() => {
              setRenameDb(menu.db);
              setMenu(null);
            }}
          >
            <Pencil size={13} className="text-[var(--muted)]" />
            Переименовать
          </button>
        </div>
      )}

      <RenameDatabaseModal open={!!renameDb} db={renameDb} onClose={() => setRenameDb(null)} />
    </aside>
  );
}
