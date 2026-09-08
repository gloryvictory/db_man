export interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  created_at: string;
  hasPassword: boolean;
}

export interface ColumnMeta {
  name: string;
  data_type: string;
  not_null: boolean;
  default_value: string | null;
  position: number;
  is_primary: boolean;
  foreign_ref: string | null;
}

export interface TableMeta {
  name: string;
  kind: string;
  row_estimate: number;
}

export interface RowsResult {
  columns: string[];
  rows: unknown[][];
  total: number;
  limit: number;
  offset: number;
}

export interface StatsRow {
  schema: string;
  name: string;
  rows: number;
}

export interface LogRow {
  id: number;
  connection_id: string | null;
  database: string | null;
  query: string;
  duration_ms: number;
  rows: number;
  error: string | null;
  created_at: string;
}
