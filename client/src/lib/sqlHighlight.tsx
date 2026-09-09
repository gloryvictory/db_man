const KEYWORDS = new Set([
  'CREATE', 'TABLE', 'PRIMARY', 'KEY', 'NOT', 'NULL', 'DEFAULT', 'REFERENCES', 'UNIQUE',
  'CONSTRAINT', 'CHECK', 'FOREIGN', 'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS', 'AND', 'OR',
  'IN', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE', 'SET', 'ALTER', 'DROP', 'ADD', 'INDEX',
  'IF', 'EXISTS', 'CASCADE', 'RESTRICT', 'VACUUM', 'ANALYZE', 'REINDEX', 'WITH', 'GRANT', 'REVOKE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'GENERATED', 'ALWAYS', 'IDENTITY', 'USING', 'COLLATE', 'DISTINCT',
  'ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'THEN', 'ELSE', 'END',
  'CASE', 'WHEN', 'RETURNING', 'TRUNCATE', 'COMMENT', 'SCHEMA', 'SEQUENCE', 'VIEW', 'MATERIALIZED',
  'DATABASE', 'EXTENSION', 'OWNER', 'ENCODING', 'TEMPLATE', 'CONNECTION', 'START', 'INCREMENT',
  'MINVALUE', 'MAXVALUE', 'CACHE', 'CYCLE', 'COLUMN', 'LC_COLLATE', 'LC_CTYPE',
]);

const TYPES = new Set([
  'int2', 'int4', 'int8', 'smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double',
  'precision', 'serial', 'bigserial', 'smallserial', 'text', 'varchar', 'char', 'character', 'varying',
  'bpchar', 'boolean', 'bool', 'date', 'time', 'timestamp', 'timestamptz', 'timetz', 'interval', 'json',
  'jsonb', 'uuid', 'bytea', 'geometry', 'geography', 'point', 'xml', 'money', 'inet', 'cidr', 'macaddr',
  'oid', 'regclass', 'regtype', 'tsvector', 'tsquery', 'bit', 'varbit', 'array',
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightSqlHtml(sql: string): string {
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_]+)/g;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    let style = 'color:var(--text)';
    if (m[1]) style = 'color:var(--faint);font-style:italic';
    else if (m[2]) style = 'color:var(--amber)';
    else if (m[3]) style = 'color:var(--amber)';
    else if (m[4]) {
      const up = m[4].toUpperCase();
      const low = m[4].toLowerCase();
      if (KEYWORDS.has(up)) style = 'color:var(--violet)';
      else if (TYPES.has(low)) style = 'color:var(--cyan)';
    }
    out += `<span style="${style}">${escapeHtml(m[0])}</span>`;
  }
  return out;
}

export function SqlCode({ sql }: { sql: string }) {
  return (
    <pre
      className="whitespace-pre font-mono text-[12.5px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: highlightSqlHtml(sql) }}
    />
  );
}
