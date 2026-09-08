import type { StoredConnection, TableMeta, ColumnMeta, RowsResult, StatsRow, LogRow } from './types';

const BASE = '/api';
const enc = encodeURIComponent;

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

export interface CreateConnRes extends StoredConnection {
  connected: boolean;
  error?: string;
}

export const api = {
  health: () => http<{ status: string; time: string }>('/health'),
  listConnections: () => http<StoredConnection[]>('/connections'),
  createConnection: (d: Record<string, unknown>) =>
    http<CreateConnRes>('/connections', { method: 'POST', body: JSON.stringify(d) }),
  updateConnection: (id: string, d: Record<string, unknown>) =>
    http<StoredConnection>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteConnection: (id: string) => http<{ ok: boolean }>(`/connections/${id}`, { method: 'DELETE' }),
  connect: (id: string, password?: string) =>
    http<{ connected: boolean }>(`/connections/${id}/connect`, {
      method: 'POST',
      body: JSON.stringify({ password: password ?? undefined }),
    }),
  disconnect: (id: string) => http<{ ok: boolean }>(`/connections/${id}/disconnect`, { method: 'POST' }),
  databases: (id: string) => http<string[]>(`/connections/${id}/databases`),
  schemas: (id: string, db: string) => http<string[]>(`/connections/${id}/databases/${enc(db)}/schemas`),
  tables: (id: string, db: string, schema: string) =>
    http<TableMeta[]>(`/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables`),
  columns: (id: string, db: string, schema: string, table: string) =>
    http<ColumnMeta[]>(`/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/columns`),
  rows: (
    id: string,
    db: string,
    schema: string,
    table: string,
    p: { limit: number; offset: number; sort?: string; dir?: string; filter?: string }
  ) =>
    http<RowsResult>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/rows` + qs(p)
    ),
  stats: (id: string, db: string) => http<StatsRow[]>(`/connections/${id}/databases/${enc(db)}/stats`),
  logs: (limit = 200) => http<LogRow[]>(`/logs?limit=${limit}`),
  exportUrl: (id: string, db: string, schema: string, table: string, format: 'xlsx' | 'csv') =>
    `/api/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/export?format=${format}`,
};
