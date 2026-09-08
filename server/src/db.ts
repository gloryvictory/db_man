import type { Pool } from 'pg';
import { getPool } from './pools';
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
  try {
    const res = await pool.query(sql, params as never[]);
    logQuery({
      connection_id: meta.connId,
      database: meta.db,
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
