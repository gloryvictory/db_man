import { useEffect } from 'react';
import { ChevronRight, Server, Database, Layers, Table } from 'lucide-react';
import { useStore, type TreeNode } from '../store';
import { Loader } from './ui';

function iconFor(kind: TreeNode['kind']) {
  switch (kind) {
    case 'conn':
      return <Server size={13} className="text-[#35c98e]" />;
    case 'db':
      return <Database size={13} className="text-[#5aa7e8]" />;
    case 'schema':
      return <Layers size={13} className="text-[#e0a94f]" />;
    default:
      return <Table size={13} className="text-[#8b93a7]" />;
  }
}

function NodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const store = useStore();
  const expanded = !!store.expanded[node.id];
  const loading = !!store.loadingNodes[node.id];
  const children = store.children[node.id];
  const hasChildren = node.kind !== 'table';
  const selected =
    node.kind === 'table' &&
    store.selected?.table === node.table &&
    store.selected?.schema === node.schema &&
    store.selected?.db === node.db;

  return (
    <div>
      <div
        className={`flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[12.5px] hover:bg-[#1e2330] ${
          selected ? 'bg-[#0f2b21] text-[#35c98e]' : 'text-[#e7eaf0]'
        }`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() =>
          node.kind === 'table'
            ? store.selectTable(node.db!, node.schema!, node.table!)
            : store.toggleNode(node)
        }
      >
        <span
          className={`flex w-3 shrink-0 items-center justify-center text-[9px] text-[#5c6478] transition-transform ${
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
          <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-[#5c6478]">
            {node.rowEstimate != null ? node.rowEstimate.toLocaleString('ru-RU') : ''}
          </span>
        )}
        {node.kind === 'table' && node.tableKind && node.tableKind !== 'table' && (
          <span className="ml-1 shrink-0 rounded bg-[#1b1e26] px-1 font-mono text-[9px] text-[#8b93a7]">
            {node.tableKind}
          </span>
        )}
      </div>

      {expanded && children && (
        <div className="ml-[13px] border-l border-[#272c39]">
          {children.map((c) => (
            <NodeRow key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const store = useStore();

  useEffect(() => {
    store.loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conn = store.connections.find((c) => c.id === store.activeConnId);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-[#272c39] bg-[#12151c]">
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!store.activeConnId || !conn ? (
          <div className="px-2 py-1 text-[12px] text-[#5c6478]">
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
            />
            {!store.connected && (
              <div className="px-6 py-1 text-[12px] text-[#5c6478]">
                Не подключено — нажмите «Подключить».
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
