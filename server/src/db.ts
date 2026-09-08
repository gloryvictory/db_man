import type { Pool } from 'pg';
import { getPool, getSecrets } from './pools';
import { assertIdent, quote } from './ident';
import { logQuery } from './sqlite';

export interface ColumnMeta {
  name: string;
  data_type: string;
  not_null: boolean;
  default_value: string | null;
  position: number;
  is_primary: boolean;
  foreign_ref: string | null;
}

export interface RowsOptions {
  limit: number;
  offset: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filter?: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function q(pool: Pool, meta: { connId: string; db: string }, sql: string, params: unknown[] = []) {
  const start = Date.now();
  const s = getSecrets(meta.connId);
  const host = s?.host ?? null;
  const port = s?.port ?? null;
  const username = s?.user ?? null;
  const dsn = host ? `postgresql://${username ?? ''}@${host}:${port ?? 5432}/${meta.db}` : null;
  try {
    const res = await pool.query(sql, params as never[]);
    logQuery({
      connection_id: meta.connId,
      database: meta.db,
      host,
      port,
      username,
      dsn,
      query: truncate(sql, 300),
      duration_ms: Date.now() - start,
      rows: res.rows.length,
      error: null,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logQuery({
      connection_id: meta.connId,
      database: meta.db,
      host,
      port,
      username,
      dsn,
      query: truncate(sql, 300),
      duration_ms: Date.now() - start,
      rows: 0,
      error: msg,
    });
    throw e;
  }
}

export function sanitize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  return v;
}

// ---------- каталог ----------

export async function listDatabases(connId: string, defaultDb: string): Promise<string[]> {
  const pool = getPool(connId, defaultDb);
  const res = await q(
    pool,
    { connId, db: defaultDb },
    `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
  );
  return res.rows.map((r) => r.datname);
}

export async function listSchemas(connId: string, db: string): Promise<string[]> {
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT nspname FROM pg_namespace
     WHERE nspname NOT IN ('pg_catalog', 'information_schema')
       AND nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
     ORDER BY nspname`
  );
  return res.rows.map((r) => r.nspname);
}

export interface TableMeta {
  name: string;
  kind: string;
  row_estimate: number;
}

export async function listTables(connId: string, db: string, schema: string): Promise<TableMeta[]> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT c.relname AS name,
            CASE c.relkind
              WHEN 'r' THEN 'table'
              WHEN 'p' THEN 'partitioned'
              WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'materialized'
              ELSE c.relkind::text
            END AS kind,
            GREATEST(c.reltuples::bigint, 0) AS row_estimate
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm')
     ORDER BY c.relname`,
    [schema]
  );
  return res.rows.map((r) => ({
    name: r.name,
    kind: r.kind,
    row_estimate: Number(r.row_estimate),
  }));
}

export async function getColumns(connId: string, db: string, schema: string, table: string): Promise<ColumnMeta[]> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);

  const base = await q(
    pool,
    { connId, db },
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            a.attnotnull AS not_null,
            pg_get_expr(d.adbin, d.adrelid) AS default_value,
            a.attnum AS position
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [schema, table]
  );

  const pk = await q(
    pool,
    { connId, db },
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE n.nspname = $1 AND c.relname = $2 AND i.indisprimary`,
    [schema, table]
  );

  const fk = await q(
    pool,
    { connId, db },
    `SELECT a.attname AS column_name,
            rn.nspname AS ref_schema,
            rc.relname AS ref_table,
            ra.attname AS ref_column
     FROM pg_constraint fk
     JOIN pg_class c ON c.oid = fk.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(fk.conkey)
     JOIN pg_class rc ON rc.oid = fk.confrelid
     JOIN pg_namespace rn ON rn.oid = rc.relnamespace
     JOIN pg_attribute ra ON ra.attrelid = rc.oid AND ra.attnum = ANY(fk.confkey)
     WHERE n.nspname = $1 AND c.relname = $2 AND fk.contype = 'f'`,
    [schema, table]
  );

  const pkCols = new Set<string>(pk.rows.map((r) => r.attname));
  const fkMap = new Map<string, string>();
  for (const r of fk.rows) fkMap.set(r.column_name, `${r.ref_schema}.${r.ref_table}.${r.ref_column}`);

  return base.rows.map((r) => ({
    name: r.name,
    data_type: r.data_type,
    not_null: r.not_null,
    default_value: r.default_value,
    position: r.position,
    is_primary: pkCols.has(r.name),
    foreign_ref: fkMap.get(r.name) ?? null,
  }));
}

// ---------- данные ----------

function buildWhere(columns: ColumnMeta[], filter?: string): string {
  if (!filter || !filter.trim()) return '';
  const parts = columns.map((c) => `${quote(c.name)}::text ILIKE $1`).join(' OR ');
  return ` WHERE (${parts})`;
}

export interface RowsResult {
  columns: string[];
  rows: unknown[][];
  total: number;
  limit: number;
  offset: number;
}

export async function getRows(
  connId: string,
  db: string,
  schema: string,
  table: string,
  opts: RowsOptions
): Promise<RowsResult> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);

  const columns = await getColumns(connId, db, schema, table);
  const colNames = columns.map((c) => c.name);
  const colList = colNames.map(quote).join(', ');

  const where = buildWhere(columns, opts.filter);
  const params: unknown[] = [];
  if (opts.filter && opts.filter.trim()) params.push(`%${opts.filter.trim()}%`);

  const orderBy =
    opts.sort && colNames.includes(opts.sort)
      ? ` ORDER BY ${quote(opts.sort)} ${opts.dir === 'desc' ? 'DESC' : 'ASC'}`
      : '';

  const limit = Math.min(Math.max(opts.limit, 1), 1000);
  const offset = Math.max(opts.offset, 0);

  const sql = `SELECT ${colList} FROM ${quote(schema)}.${quote(table)}${where}${orderBy} LIMIT ${limit} OFFSET ${offset}`;
  const res = await q(pool, { connId, db }, sql, params);
  const rows = res.rows.map((r) => colNames.map((n) => sanitize(r[n])));

  const countSql = `SELECT count(*)::bigint AS n FROM ${quote(schema)}.${quote(table)}${where}`;
  const countRes = await q(pool, { connId, db }, countSql, params);
  const total = Number(countRes.rows[0].n);

  return { columns: colNames, rows, total, limit, offset };
}

export async function getExportRows(connId: string, db: string, schema: string, table: string, limit = 50000) {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);
  const columns = await getColumns(connId, db, schema, table);
  const colNames = columns.map((c) => c.name);
  const cap = Math.min(Math.max(limit, 1), 100000);
  const sql = `SELECT ${colNames.map(quote).join(', ')} FROM ${quote(schema)}.${quote(table)} LIMIT ${cap}`;
  const res = await q(pool, { connId, db }, sql);
  return { columns: colNames, rows: res.rows.map((r) => colNames.map((n) => sanitize(r[n]))) };
}

export interface StatsRow {
  schema: string;
  name: string;
  rows: number;
}

export async function getStats(connId: string, db: string): Promise<StatsRow[]> {
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT n.nspname AS schema, c.relname AS name, GREATEST(c.reltuples::bigint, 0) AS rows
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
       AND c.relkind IN ('r', 'p', 'm')
     ORDER BY rows DESC
     LIMIT 50`
  );
  return res.rows.map((r) => ({ schema: r.schema, name: r.name, rows: Number(r.rows) }));
}

// ---------- сервис / обслуживание ----------

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

export async function getTableService(connId: string, db: string, schema: string, table: string): Promise<ServiceResult> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);

  const info = await q(
    pool,
    { connId, db },
    `SELECT
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_total_relation_size(c.oid) AS total_size_bytes,
       pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
       pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
       pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid)) AS toast_size,
       COALESCE(ts.spcname, 'pg_default') AS tablespace,
       c.relfilenode::text AS relfilenode,
       GREATEST(c.reltuples::bigint, 0) AS estimated_rows,
       c.relpages::bigint AS relpages,
       am.amname AS access_method
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_tablespace ts ON ts.oid = c.reltablespace
     LEFT JOIN pg_am am ON am.oid = c.relam
     WHERE n.nspname = $1 AND c.relname = $2`,
    [schema, table]
  );

  const indexes = await q(
    pool,
    { connId, db },
    `SELECT
       idx.relname AS name,
       pg_get_indexdef(idx.oid) AS definition,
       am.amname AS access_method,
       pg_size_pretty(pg_relation_size(idx.oid)) AS size,
       pg_relation_size(idx.oid) AS size_bytes,
       i.indisunique AS is_unique,
       i.indisprimary AS is_primary,
       i.indisvalid AS is_valid,
       COALESCE(s.idx_scan, 0) AS idx_scan,
       COALESCE(s.idx_tup_read, 0) AS idx_tup_read,
       COALESCE(s.idx_tup_fetch, 0) AS idx_tup_fetch
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_class idx ON idx.oid = i.indexrelid
     JOIN pg_am am ON am.oid = idx.relam
     LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = idx.oid
     WHERE n.nspname = $1 AND c.relname = $2
     ORDER BY i.indisprimary DESC, idx.relname`,
    [schema, table]
  );

  const stats = await q(
    pool,
    { connId, db },
    `SELECT
       last_vacuum, last_autovacuum, vacuum_count, autovacuum_count,
       last_analyze, last_autoanalyze, analyze_count, autoanalyze_count,
       n_live_tup, n_dead_tup, n_mod_since_analyze
     FROM pg_stat_all_tables
     WHERE schemaname = $1 AND relname = $2`,
    [schema, table]
  );

  const geo = await q(
    pool,
    { connId, db },
    `SELECT a.attname AS name
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_type t ON t.oid = a.atttypid
     WHERE n.nspname = $1 AND c.relname = $2
       AND a.attnum > 0 AND NOT a.attisdropped
       AND t.typname IN ('geometry', 'geography')
     ORDER BY a.attnum`,
    [schema, table]
  );

  const spatial = await q(
    pool,
    { connId, db },
    `SELECT
       idx.relname AS name,
       am.amname AS access_method,
       pg_get_indexdef(idx.oid) AS definition,
       pg_size_pretty(pg_relation_size(idx.oid)) AS size,
       a.attname AS column_name
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_class idx ON idx.oid = i.indexrelid
     JOIN pg_am am ON am.oid = idx.relam
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     JOIN pg_type t ON t.oid = a.atttypid
     WHERE n.nspname = $1 AND c.relname = $2
       AND am.amname IN ('gist', 'spgist')
       AND t.typname IN ('geometry', 'geography')
     ORDER BY idx.relname`,
    [schema, table]
  );

  const infoRow = info.rows[0] as Record<string, unknown> | undefined;
  const statsRow = stats.rows[0] as Record<string, unknown> | undefined;

  return {
    table: infoRow
      ? {
          total_size: String(infoRow.total_size),
          total_size_bytes: Number(infoRow.total_size_bytes),
          table_size: String(infoRow.table_size),
          indexes_size: String(infoRow.indexes_size),
          toast_size: String(infoRow.toast_size),
          tablespace: String(infoRow.tablespace),
          relfilenode: String(infoRow.relfilenode),
          estimated_rows: Number(infoRow.estimated_rows),
          relpages: Number(infoRow.relpages),
          access_method: String(infoRow.access_method),
        }
      : null,
    indexes: indexes.rows.map((r: Record<string, unknown>) => ({
      name: String(r.name),
      definition: String(r.definition),
      access_method: String(r.access_method),
      size: String(r.size),
      size_bytes: Number(r.size_bytes),
      is_unique: Boolean(r.is_unique),
      is_primary: Boolean(r.is_primary),
      is_valid: Boolean(r.is_valid),
      idx_scan: Number(r.idx_scan),
      idx_tup_read: Number(r.idx_tup_read),
      idx_tup_fetch: Number(r.idx_tup_fetch),
    })),
    stats: statsRow
      ? {
          last_vacuum: sanitize(statsRow.last_vacuum) as string | null,
          last_autovacuum: sanitize(statsRow.last_autovacuum) as string | null,
          vacuum_count: Number(statsRow.vacuum_count),
          autovacuum_count: Number(statsRow.autovacuum_count),
          last_analyze: sanitize(statsRow.last_analyze) as string | null,
          last_autoanalyze: sanitize(statsRow.last_autoanalyze) as string | null,
          analyze_count: Number(statsRow.analyze_count),
          autoanalyze_count: Number(statsRow.autoanalyze_count),
          n_live_tup: Number(statsRow.n_live_tup),
          n_dead_tup: Number(statsRow.n_dead_tup),
          n_mod_since_analyze: Number(statsRow.n_mod_since_analyze),
        }
      : null,
    geometry_columns: geo.rows.map((r: Record<string, unknown>) => String(r.name)),
    spatial_indexes: spatial.rows.map((r: Record<string, unknown>) => ({
      name: String(r.name),
      access_method: String(r.access_method),
      definition: String(r.definition),
      size: String(r.size),
      column_name: String(r.column_name),
    })),
  };
}

export async function reindexTable(connId: string, db: string, schema: string, table: string, index: string): Promise<void> {
  assertIdent(schema);
  assertIdent(table);
  assertIdent(index, 'индекс');
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `REINDEX INDEX ${quote(schema)}.${quote(index)}`);
}

export async function reindexAllTable(connId: string, db: string, schema: string, table: string): Promise<void> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `REINDEX TABLE ${quote(schema)}.${quote(table)}`);
}

export async function vacuumTable(connId: string, db: string, schema: string, table: string): Promise<void> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `VACUUM ${quote(schema)}.${quote(table)}`);
}

export async function analyzeTable(connId: string, db: string, schema: string, table: string): Promise<void> {
  assertIdent(schema);
  assertIdent(table);
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `ANALYZE ${quote(schema)}.${quote(table)}`);
}

export async function createSpatialIndex(connId: string, db: string, schema: string, table: string, column: string): Promise<void> {
  assertIdent(schema);
  assertIdent(table);
  assertIdent(column, 'колонка');
  const pool = getPool(connId, db);
  const idxName = `idx_${table}_${column}_gist`;
  await q(
    pool,
    { connId, db },
    `CREATE INDEX IF NOT EXISTS ${quote(idxName)} ON ${quote(schema)}.${quote(table)} USING GIST (${quote(column)})`
  );
}

// ---------- уровень базы данных ----------

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

export async function getDatabaseInfo(connId: string, db: string): Promise<DatabaseInfo> {
  const pool = getPool(connId, db);

  const meta = await q(
    pool,
    { connId, db },
    `SELECT
       d.datname AS name,
       r.rolname AS owner,
       pg_encoding_to_char(d.encoding) AS encoding,
       d.datcollate AS collation,
       d.datctype AS ctype,
       d.datconnlimit AS connection_limit,
       pg_size_pretty(pg_database_size(d.datname)) AS total_size,
       pg_database_size(d.datname) AS total_size_bytes
     FROM pg_database d
     JOIN pg_roles r ON r.oid = d.datdba
     WHERE d.datname = $1`,
    [db]
  );

  const agg = await q(
    pool,
    { connId, db },
    `SELECT
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
          AND c.relkind IN ('r','p','m')) AS table_count,
       (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\') AS index_count,
       (SELECT count(*) FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog','information_schema') AND nspname NOT LIKE 'pg\\_%' ESCAPE '\\') AS schema_count,
       (SELECT pg_size_pretty(COALESCE(sum(pg_total_relation_size(c.oid)), 0))
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
          AND c.relkind IN ('r','p','m')) AS tables_size,
       (SELECT pg_size_pretty(COALESCE(sum(pg_indexes_size(c.oid)), 0))
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
          AND c.relkind IN ('r','p','m')) AS indexes_size,
       (SELECT count(*) FROM pg_stat_activity WHERE datname = $1) AS active_connections`,
    [db]
  );

  const m = meta.rows[0] as Record<string, unknown>;
  const a = agg.rows[0] as Record<string, unknown>;

  return {
    name: String(m.name),
    owner: String(m.owner),
    encoding: String(m.encoding),
    collation: String(m.collation),
    ctype: String(m.ctype),
    connection_limit: Number(m.connection_limit),
    total_size: String(m.total_size),
    total_size_bytes: Number(m.total_size_bytes),
    table_count: Number(a.table_count),
    index_count: Number(a.index_count),
    schema_count: Number(a.schema_count),
    tables_size: String(a.tables_size),
    indexes_size: String(a.indexes_size),
    active_connections: Number(a.active_connections),
  };
}

export async function getDatabaseStats(connId: string, db: string): Promise<DatabaseStats | null> {
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT numbackends, xact_commit, xact_rollback, blks_read, blks_hit,
            tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
            conflicts, temp_files, temp_bytes, deadlocks,
            blk_read_time, blk_write_time, stats_reset
     FROM pg_stat_database
     WHERE datname = $1`,
    [db]
  );
  const r = res.rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    numbackends: Number(r.numbackends),
    xact_commit: Number(r.xact_commit),
    xact_rollback: Number(r.xact_rollback),
    blks_read: Number(r.blks_read),
    blks_hit: Number(r.blks_hit),
    tup_returned: Number(r.tup_returned),
    tup_fetched: Number(r.tup_fetched),
    tup_inserted: Number(r.tup_inserted),
    tup_updated: Number(r.tup_updated),
    tup_deleted: Number(r.tup_deleted),
    conflicts: Number(r.conflicts),
    temp_files: Number(r.temp_files),
    temp_bytes: Number(r.temp_bytes),
    deadlocks: Number(r.deadlocks),
    blk_read_time: Number(r.blk_read_time),
    blk_write_time: Number(r.blk_write_time),
    stats_reset: sanitize(r.stats_reset) as string | null,
  };
}

export async function vacuumDatabase(connId: string, db: string): Promise<void> {
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, 'VACUUM');
}

export async function analyzeDatabase(connId: string, db: string): Promise<void> {
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, 'ANALYZE');
}

export async function reindexDatabase(connId: string, db: string): Promise<void> {
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `REINDEX DATABASE ${quote(db)}`);
}

// ---------- уровень схемы ----------

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
  last_vacuum: string | null;
  last_analyze: string | null;
}

export async function getSchemaInfo(connId: string, db: string, schema: string): Promise<SchemaInfo> {
  assertIdent(schema);
  const pool = getPool(connId, db);

  const meta = await q(
    pool,
    { connId, db },
    `SELECT n.nspname AS name, r.rolname AS owner
     FROM pg_namespace n
     JOIN pg_roles r ON r.oid = n.nspowner
     WHERE n.nspname = $1`,
    [schema]
  );

  const agg = await q(
    pool,
    { connId, db },
    `SELECT
       count(*) AS table_count,
       (SELECT count(*) FROM pg_index i JOIN pg_class c2 ON c2.oid = i.indrelid JOIN pg_namespace n2 ON n2.oid = c2.relnamespace WHERE n2.nspname = $1) AS index_count,
       pg_size_pretty(COALESCE(sum(pg_total_relation_size(c.oid)), 0)) AS total_size,
       COALESCE(sum(pg_total_relation_size(c.oid)), 0) AS total_size_bytes,
       pg_size_pretty(COALESCE(sum(pg_relation_size(c.oid)), 0)) AS tables_size,
       pg_size_pretty(COALESCE(sum(pg_indexes_size(c.oid)), 0)) AS indexes_size,
       pg_size_pretty(COALESCE(sum(pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid)), 0)) AS toast_size
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind IN ('r','p','m')`,
    [schema]
  );

  const m = meta.rows[0] as Record<string, unknown> | undefined;
  if (!m) {
    throw Object.assign(new Error(`Схема не найдена: ${schema}`), { status: 404 });
  }
  const a = agg.rows[0] as Record<string, unknown>;

  return {
    name: String(m.name),
    owner: String(m.owner),
    table_count: Number(a.table_count),
    index_count: Number(a.index_count),
    total_size: String(a.total_size),
    total_size_bytes: Number(a.total_size_bytes),
    tables_size: String(a.tables_size),
    indexes_size: String(a.indexes_size),
    toast_size: String(a.toast_size),
  };
}

export async function getSchemaAnalysis(connId: string, db: string, schema: string): Promise<SchemaTableRow[]> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT
       c.relname AS name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized' ELSE c.relkind::text END AS kind,
       obj_description(c.oid, 'pg_class') AS comment,
       GREATEST(c.reltuples::bigint, 0) AS row_estimate,
       pg_relation_size(c.oid) AS table_size,
       pg_indexes_size(c.oid) AS indexes_size,
       pg_total_relation_size(c.oid) AS total_size,
       (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
       st.last_vacuum,
       st.last_analyze
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_stat_all_tables st ON st.relid = c.oid
     WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m')
     ORDER BY c.relname`,
    [schema]
  );

  return res.rows.map((r: Record<string, unknown>) => ({
    name: String(r.name),
    kind: String(r.kind),
    comment: sanitize(r.comment) as string | null,
    column_count: Number(r.column_count),
    row_estimate: Number(r.row_estimate),
    table_size: Number(r.table_size),
    indexes_size: Number(r.indexes_size),
    total_size: Number(r.total_size),
    last_vacuum: sanitize(r.last_vacuum) as string | null,
    last_analyze: sanitize(r.last_analyze) as string | null,
  }));
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
  last_vacuum: string | null;
  last_analyze: string | null;
}

export async function getDatabaseAnalysis(connId: string, db: string): Promise<DatabaseTableRow[]> {
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT
       n.nspname AS schema,
       c.relname AS name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized' ELSE c.relkind::text END AS kind,
       obj_description(c.oid, 'pg_class') AS comment,
       (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
       GREATEST(c.reltuples::bigint, 0) AS row_estimate,
       pg_relation_size(c.oid) AS table_size,
       pg_indexes_size(c.oid) AS indexes_size,
       pg_total_relation_size(c.oid) AS total_size,
       st.last_vacuum,
       st.last_analyze
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_stat_all_tables st ON st.relid = c.oid
     WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
       AND c.relkind IN ('r', 'p', 'v', 'm')
     ORDER BY n.nspname, c.relname`
  );

  return res.rows.map((r: Record<string, unknown>) => ({
    schema: String(r.schema),
    name: String(r.name),
    kind: String(r.kind),
    comment: sanitize(r.comment) as string | null,
    column_count: Number(r.column_count),
    row_estimate: Number(r.row_estimate),
    table_size: Number(r.table_size),
    indexes_size: Number(r.indexes_size),
    total_size: Number(r.total_size),
    last_vacuum: sanitize(r.last_vacuum) as string | null,
    last_analyze: sanitize(r.last_analyze) as string | null,
  }));
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

export async function getSchemaStats(connId: string, db: string, schema: string): Promise<SchemaStats> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  const res = await q(
    pool,
    { connId, db },
    `SELECT
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind IN ('r','p','m')) AS table_count,
       COALESCE(sum(st.n_live_tup), 0) AS live_tup,
       COALESCE(sum(st.n_dead_tup), 0) AS dead_tup,
       COALESCE(sum(st.n_tup_ins), 0) AS n_tup_ins,
       COALESCE(sum(st.n_tup_upd), 0) AS n_tup_upd,
       COALESCE(sum(st.n_tup_del), 0) AS n_tup_del,
       COALESCE(sum(st.vacuum_count), 0) AS vacuum_count,
       COALESCE(sum(st.autovacuum_count), 0) AS autovacuum_count,
       COALESCE(sum(st.analyze_count), 0) AS analyze_count,
       COALESCE(sum(st.autoanalyze_count), 0) AS autoanalyze_count,
       max(st.last_vacuum) AS last_vacuum,
       max(st.last_autovacuum) AS last_autovacuum,
       max(st.last_analyze) AS last_analyze,
       max(st.last_autoanalyze) AS last_autoanalyze
     FROM pg_stat_all_tables st
     WHERE st.schemaname = $1`,
    [schema]
  );
  const r = res.rows[0] as Record<string, unknown>;
  return {
    table_count: Number(r.table_count),
    live_tup: Number(r.live_tup),
    dead_tup: Number(r.dead_tup),
    n_tup_ins: Number(r.n_tup_ins),
    n_tup_upd: Number(r.n_tup_upd),
    n_tup_del: Number(r.n_tup_del),
    vacuum_count: Number(r.vacuum_count),
    autovacuum_count: Number(r.autovacuum_count),
    analyze_count: Number(r.analyze_count),
    autoanalyze_count: Number(r.autoanalyze_count),
    last_vacuum: sanitize(r.last_vacuum) as string | null,
    last_autovacuum: sanitize(r.last_autovacuum) as string | null,
    last_analyze: sanitize(r.last_analyze) as string | null,
    last_autoanalyze: sanitize(r.last_autoanalyze) as string | null,
  };
}

async function schemaTableList(pool: Pool, meta: { connId: string; db: string }, schema: string): Promise<string[]> {
  const res = await q(
    pool,
    meta,
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind IN ('r','p') ORDER BY c.relname`,
    [schema]
  );
  return res.rows.map((r: Record<string, unknown>) => `${quote(schema)}.${quote(String(r.relname))}`);
}

export async function vacuumSchema(connId: string, db: string, schema: string): Promise<void> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  const meta = { connId, db };
  const names = await schemaTableList(pool, meta, schema);
  if (!names.length) return;
  await q(pool, meta, `VACUUM ${names.join(', ')}`);
}

export async function analyzeSchema(connId: string, db: string, schema: string): Promise<void> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  const meta = { connId, db };
  const names = await schemaTableList(pool, meta, schema);
  if (!names.length) return;
  await q(pool, meta, `ANALYZE ${names.join(', ')}`);
}

export async function reindexSchema(connId: string, db: string, schema: string): Promise<void> {
  assertIdent(schema);
  const pool = getPool(connId, db);
  await q(pool, { connId, db }, `REINDEX SCHEMA ${quote(schema)}`);
}
