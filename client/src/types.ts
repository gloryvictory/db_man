export interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  created_at: string;
  hasPassword: boolean;
  hasSavedPassword: boolean;
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
  unused: boolean;
  duplicate: boolean;
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
  extensions: string[];
}

export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  collation: string;
  ctype: string;
  connection_limit: number;
  total_size: string;
  total_size_bytes: number;
  table_count: number;
  index_count: number;
  schema_count: number;
  tables_size: string;
  indexes_size: string;
  active_connections: number;
}

export interface DatabaseStats {
  numbackends: number;
  xact_commit: number;
  xact_rollback: number;
  blks_read: number;
  blks_hit: number;
  tup_returned: number;
  tup_fetched: number;
  tup_inserted: number;
  tup_updated: number;
  tup_deleted: number;
  conflicts: number;
  temp_files: number;
  temp_bytes: number;
  deadlocks: number;
  blk_read_time: number;
  blk_write_time: number;
  stats_reset: string | null;
}

export interface SchemaInfo {
  name: string;
  owner: string;
  table_count: number;
  index_count: number;
  total_size: string;
  total_size_bytes: number;
  tables_size: string;
  indexes_size: string;
  toast_size: string;
}

export interface SchemaTableRow {
  name: string;
  kind: string;
  comment: string | null;
  column_count: number;
  row_estimate: number;
  table_size: number;
  indexes_size: number;
  total_size: number;
  dead_tup: number;
  dead_ratio: number;
  mod_since_analyze: number;
  needs_analyze: boolean;
  unused_index_count: number;
  unused_index_bytes: number;
  duplicate_index_count: number;
  last_vacuum: string | null;
  last_analyze: string | null;
}

export interface DatabaseTableRow {
  schema: string;
  name: string;
  kind: string;
  comment: string | null;
  column_count: number;
  row_estimate: number;
  table_size: number;
  indexes_size: number;
  total_size: number;
  dead_tup: number;
  dead_ratio: number;
  mod_since_analyze: number;
  needs_analyze: boolean;
  unused_index_count: number;
  unused_index_bytes: number;
  duplicate_index_count: number;
  last_vacuum: string | null;
  last_analyze: string | null;
}

export interface SchemaStats {
  table_count: number;
  live_tup: number;
  dead_tup: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  vacuum_count: number;
  autovacuum_count: number;
  analyze_count: number;
  autoanalyze_count: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
}

export interface OverviewTable {
  schema: string;
  name: string;
  rows: number;
  total_size: number;
  dead_tup: number;
  dead_ratio: number;
  unused_index_count: number;
  unused_index_bytes: number;
  duplicate_index_count: number;
}

export interface OverviewResult {
  biggest: OverviewTable[];
  bloated: OverviewTable[];
  unused_indexes: OverviewTable[];
  totals: {
    dead_tuples: number;
    unused_index_count: number;
    unused_index_bytes: number;
    duplicate_index_count: number;
  };
}

export interface ServerConfigRow {
  name: string;
  value: string;
}

export interface AuditEntry {
  id: number;
  username: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  status: 'ok' | 'error';
  error: string | null;
  created_at: string;
}

export interface AuditResult {
  rows: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchResult {
  tables: { schema: string; name: string; comment: string | null; kind: string }[];
  columns: { schema: string; table: string; name: string; data_type: string }[];
  indexes: { schema: string; table: string; name: string }[];
}
