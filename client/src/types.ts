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
  host: string | null;
  port: number | null;
  username: string | null;
  dsn: string | null;
  query: string;
  duration_ms: number;
  rows: number;
  error: string | null;
  created_at: string;
}

export interface LogsResult {
  rows: LogRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface TableServiceInfo {
  total_size: string;
  total_size_bytes: number;
  table_size: string;
  indexes_size: string;
  toast_size: string;
  tablespace: string;
  relfilenode: string;
  estimated_rows: number;
  relpages: number;
  access_method: string;
}

export interface IndexInfo {
  name: string;
  definition: string;
  access_method: string;
  size: string;
  size_bytes: number;
  is_unique: boolean;
  is_primary: boolean;
  is_valid: boolean;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
}

export interface TableStats {
  last_vacuum: string | null;
  last_autovacuum: string | null;
  vacuum_count: number;
  autovacuum_count: number;
  last_analyze: string | null;
  last_autoanalyze: string | null;
  analyze_count: number;
  autoanalyze_count: number;
  n_live_tup: number;
  n_dead_tup: number;
  n_mod_since_analyze: number;
}

export interface SpatialIndexInfo {
  name: string;
  access_method: string;
  definition: string;
  size: string;
  column_name: string;
}

export interface ServiceResult {
  table: TableServiceInfo | null;
  indexes: IndexInfo[];
  stats: TableStats | null;
  geometry_columns: string[];
  spatial_indexes: SpatialIndexInfo[];
}
