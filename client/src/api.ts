import type { StoredConnection, TableMeta, ColumnMeta, RowsResult, StatsRow, LogsResult, ServiceResult } from './types';

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
  service: (id: string, db: string, schema: string, table: string) =>
    http<ServiceResult>(`/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service`),
  reindex: (id: string, db: string, schema: string, table: string, index: string) =>
    http<{ ok: boolean }>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service/reindex`,
      { method: 'POST', body: JSON.stringify({ index }) }
    ),
  reindexAll: (id: string, db: string, schema: string, table: string) =>
    http<{ ok: boolean }>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service/reindex-table`,
      { method: 'POST' }
    ),
  vacuum: (id: string, db: string, schema: string, table: string) =>
    http<{ ok: boolean }>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service/vacuum`,
      { method: 'POST' }
    ),
  analyze: (id: string, db: string, schema: string, table: string) =>
    http<{ ok: boolean }>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service/analyze`,
      { method: 'POST' }
    ),
  createSpatialIndex: (id: string, db: string, schema: string, table: string, column: string) =>
    http<{ ok: boolean }>(
      `/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/service/spatial-index`,
      { method: 'POST', body: JSON.stringify({ column }) }
    ),
  logs: (limit: number, offset: number) => http<LogsResult>(`/logs?limit=${limit}&offset=${offset}`),
  exportUrl: (id: string, db: string, schema: string, table: string, format: 'xlsx' | 'csv') =>
    `/api/connections/${id}/databases/${enc(db)}/schemas/${enc(schema)}/tables/${enc(table)}/export?format=${format}`,
  logsExportUrl: (format: 'xlsx' | 'csv', page?: { limit: number; offset: number }) => {
    const p = page ? `?format=${format}&limit=${page.limit}&offset=${page.offset}` : `?format=${format}`;
    return `/api/logs/export${p}`;
  },
};
