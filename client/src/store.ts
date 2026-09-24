import { create } from 'zustand';
import toast from 'react-hot-toast';
import { api } from './api';
import type { StoredConnection, ColumnMeta } from './types';

export interface TreeNode {
  id: string;
  label: string;
  kind: 'conn' | 'db' | 'schema' | 'table';
  connId: string;
  db?: string;
  schema?: string;
  table?: string;
  rowEstimate?: number;
  tableKind?: string;
  comment?: string | null;
}

export type ViewKind = 'data' | 'structure' | 'sql' | 'service';

interface DbManState {
  connections: StoredConnection[];
  activeConnId: string | null;
  connected: boolean;
  connecting: boolean;

  children: Record<string, TreeNode[]>;
  expanded: Record<string, boolean>;
  loadingNodes: Record<string, boolean>;

  selected: { db: string; schema: string; table: string } | null;
  selectedDb: string | null;
  selectedSchema: { db: string; schema: string } | null;
  view: ViewKind;
  dbView: 'info' | 'service';
  schemaView: 'info' | 'service' | 'analysis';
  connView: 'info' | 'analysis' | 'config' | 'compare';
  selectedConn: boolean;
  columns: ColumnMeta[];
  rows: unknown[][];
  total: number;
  page: number;
  pageSize: number;
  sort: { col: string; dir: 'asc' | 'desc' } | null;
  filter: string;
  loadingTable: boolean;

  loadConnections: () => Promise<void>;
  setActiveConn: (id: string | null) => void;
  connect: (id: string, password?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  addConnection: (data: {
    name: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
    savePassword?: boolean;
  }) => Promise<{ ok: boolean; connected: boolean; error?: string }>;
  removeConnection: (id: string) => Promise<void>;
  updateConnection: (id: string, data: {
    name?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    savePassword?: boolean;
  }) => Promise<void>;
  renameDatabase: (oldDb: string, newName: string) => Promise<void>;
  toggleNode: (node: TreeNode) => Promise<void>;
  loadChildren: (node: TreeNode) => Promise<void>;
  selectTable: (db: string, schema: string, table: string) => Promise<void>;
  selectDatabase: (db: string) => void;
  selectSchema: (db: string, schema: string) => void;
  setView: (v: ViewKind) => void;
  setDbView: (v: 'info' | 'service') => void;
  setSchemaView: (v: 'info' | 'service' | 'analysis') => void;
  setConnView: (v: 'info' | 'analysis' | 'config' | 'compare') => void;
  selectConnection: () => void;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  setSort: (col: string) => void;
  setFilter: (f: string) => void;
  fetchRows: () => Promise<void>;
  reset: () => void;
}

export const useStore = create<DbManState>((set, get) => ({
  connections: [],
  activeConnId: null,
  connected: false,
  connecting: false,
  children: {},
  expanded: {},
  loadingNodes: {},
  selected: null,
  selectedDb: null,
  selectedSchema: null,
  view: 'data',
  dbView: 'info',
  schemaView: 'info',
  connView: 'info',
  selectedConn: false,
  columns: [],
  rows: [],
  total: 0,
  page: 0,
  pageSize: 25,
  sort: null,
  filter: '',
  loadingTable: false,

  loadConnections: async () => {
    const conns = await api.listConnections();
    set({ connections: conns });
  },

  setActiveConn: (id) =>
    set({ activeConnId: id, selected: null, selectedDb: null, selectedSchema: null, selectedConn: false, columns: [], rows: [], total: 0 }),

  connect: async (id, password) => {
    set({ connecting: true });
    try {
      await api.connect(id, password);
      set({ connected: true, connecting: false, selectedConn: true });
      localStorage.setItem('dbman-last-conn', id);
      const conn = get().connections.find((c) => c.id === id);
      await get().loadChildren({
        id,
        label: conn ? `${conn.host}:${conn.port}` : id,
        kind: 'conn',
        connId: id,
      });
      return true;
    } catch (e) {
      set({ connected: false, connecting: false });
      toast.error(e instanceof Error ? e.message : 'Не удалось подключиться');
      return false;
    }
  },

  disconnect: async () => {
    const id = get().activeConnId;
    if (!id) return;
    await api.disconnect(id);
    set({ connected: false, children: {}, expanded: {}, selected: null, selectedDb: null, selectedSchema: null, selectedConn: false, columns: [], rows: [], total: 0 });
  },

  addConnection: async (data) => {
    try {
      const res = await api.createConnection(data);
      await get().loadConnections();
      set({ activeConnId: res.id, connected: !!res.connected });
      if (res.connected) localStorage.setItem('dbman-last-conn', res.id);
      if (res.connected) {
        await get().loadChildren({
          id: res.id,
          label: `${data.host}:${data.port}`,
          kind: 'conn',
          connId: res.id,
        });
      }
      return { ok: true, connected: !!res.connected, error: res.error };
    } catch (e) {
      return { ok: false, connected: false, error: e instanceof Error ? e.message : 'Ошибка' };
    }
  },

  removeConnection: async (id) => {
    await api.deleteConnection(id);
    if (get().activeConnId === id) set({ activeConnId: null, connected: false, selected: null });
    if (localStorage.getItem('dbman-last-conn') === id) localStorage.removeItem('dbman-last-conn');
    await get().loadConnections();
  },

  updateConnection: async (id, data) => {
    await api.updateConnection(id, data);
    await get().loadConnections();
  },

  renameDatabase: async (oldDb, newName) => {
    const id = get().activeConnId;
    if (!id) return;
    await api.renameDatabase(id, oldDb, newName);
    const conn = get().connections.find((c) => c.id === id);
    await get().loadChildren({ id, label: conn ? `${conn.name} · ${conn.host}:${conn.port}` : id, kind: 'conn', connId: id });
    if (get().selectedDb === oldDb) {
      set({ selectedDb: null, selectedSchema: null, selected: null, columns: [], rows: [], total: 0 });
    }
  },

  toggleNode: async (node) => {
    if (get().expanded[node.id]) {
      set((s) => ({ expanded: { ...s.expanded, [node.id]: false } }));
    } else {
      await get().loadChildren(node);
    }
  },

  loadChildren: async (node) => {
    if (get().loadingNodes[node.id]) return;
    set((s) => ({ loadingNodes: { ...s.loadingNodes, [node.id]: true } }));
    try {
      const connId = node.connId;
      let kids: TreeNode[] = [];
      if (node.kind === 'conn') {
        const dbs = await api.databases(connId);
        kids = dbs.map((d) => ({ id: `${connId}::${d.name}`, label: d.name, kind: 'db' as const, connId, db: d.name, comment: d.comment }));
      } else if (node.kind === 'db' && node.db) {
        const schemas = await api.schemas(connId, node.db);
        kids = schemas.map((s) => ({
          id: `${connId}::${node.db}::${s.name}`,
          label: s.name,
          kind: 'schema' as const,
          connId,
          db: node.db,
          schema: s.name,
          comment: s.comment,
        }));
      } else if (node.kind === 'schema' && node.db && node.schema) {
        const tables = await api.tables(connId, node.db, node.schema);
        kids = tables.map((t) => ({
          id: `${connId}::${node.db}::${node.schema}::${t.name}`,
          label: t.name,
          kind: 'table' as const,
          connId,
          db: node.db,
          schema: node.schema,
          table: t.name,
          rowEstimate: t.row_estimate,
          tableKind: t.kind,
          comment: t.comment,
        }));
      }
      set((s) => ({
        children: { ...s.children, [node.id]: kids },
        expanded: { ...s.expanded, [node.id]: true },
        loadingNodes: { ...s.loadingNodes, [node.id]: false },
      }));
    } catch (e) {
      set((s) => ({ loadingNodes: { ...s.loadingNodes, [node.id]: false } }));
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  },

  selectTable: async (db, schema, table) => {
    const connId = get().activeConnId;
    if (!connId) return;
    set({
      selected: { db, schema, table },
      selectedDb: null,
      selectedSchema: null,
      selectedConn: false,
      view: 'data',
      page: 0,
      sort: null,
      filter: '',
      rows: [],
      total: 0,
      columns: [],
      loadingTable: true,
    });
    try {
      const cols = await api.columns(connId, db, schema, table);
      set({ columns: cols });
    } catch (e) {
      set({ loadingTable: false });
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  },

  setView: (v) => set({ view: v }),
  setDbView: (v) => set({ dbView: v }),
  setSchemaView: (v) => set({ schemaView: v }),
  setConnView: (v) => set({ connView: v }),
  selectConnection: () =>
    set({ selectedConn: true, selected: null, selectedDb: null, selectedSchema: null, columns: [], rows: [], total: 0 }),
  selectDatabase: (db) =>
    set({ selectedDb: db, selected: null, selectedSchema: null, selectedConn: false, columns: [], rows: [], total: 0, dbView: 'info' }),
  selectSchema: (db, schema) =>
    set({ selectedSchema: { db, schema }, selected: null, selectedDb: null, selectedConn: false, columns: [], rows: [], total: 0, schemaView: 'info' }),
  setPage: (p) => set({ page: p }),
  setPageSize: (n) => set({ pageSize: n, page: 0 }),
  setSort: (col) =>
    set((s) => {
      if (s.sort?.col === col) {
        if (s.sort.dir === 'asc') return { sort: { col, dir: 'desc' }, page: 0 };
        return { sort: null, page: 0 };
      }
      return { sort: { col, dir: 'asc' }, page: 0 };
    }),
  setFilter: (f) => set({ filter: f, page: 0 }),

  fetchRows: async () => {
    const { activeConnId, selected, page, pageSize, sort, filter } = get();
    if (!activeConnId || !selected) return;
    set({ loadingTable: true });
    try {
      const res = await api.rows(activeConnId, selected.db, selected.schema, selected.table, {
        limit: pageSize,
        offset: page * pageSize,
        sort: sort?.col,
        dir: sort?.dir,
        filter: filter || undefined,
      });
      set({ rows: res.rows, total: res.total, loadingTable: false });
    } catch (e) {
      set({ loadingTable: false });
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  },

  reset: () =>
    set({
      connections: [],
      activeConnId: null,
      connected: false,
      connecting: false,
      children: {},
      expanded: {},
      loadingNodes: {},
      selected: null,
      selectedDb: null,
      selectedSchema: null,
      selectedConn: false,
      connView: 'info',
      columns: [],
      rows: [],
      total: 0,
      page: 0,
      sort: null,
      filter: '',
    }),
}));
