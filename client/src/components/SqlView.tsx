import type { CSSProperties } from 'react';
import { useStore } from '../store';

const KEYWORDS = new Set([
  'CREATE', 'TABLE', 'PRIMARY', 'KEY', 'NOT', 'NULL', 'DEFAULT', 'REFERENCES', 'UNIQUE',
  'CONSTRAINT', 'CHECK', 'FOREIGN', 'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS', 'AND', 'OR',
  'IN', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE', 'SET', 'ALTER', 'DROP', 'ADD', 'INDEX',
  'IF', 'EXISTS', 'CASCADE', 'RESTRICT', 'VACUUM', 'ANALYZE', 'REINDEX', 'WITH', 'GRANT', 'REVOKE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'GENERATED', 'ALWAYS', 'IDENTITY', 'USING', 'COLLATE', 'DISTINCT',
  'ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'THEN', 'ELSE', 'END',
  'CASE', 'WHEN', 'RETURNING', 'TRUNCATE', 'COMMENT',
]);

const TYPES = new Set([
  'int2', 'int4', 'int8', 'smallint', 'integer', 'bigint', 'numeric', 'decimal', 'real', 'double',
  'precision', 'serial', 'bigserial', 'smallserial', 'text', 'varchar', 'char', 'character', 'varying',
  'bpchar', 'boolean', 'bool', 'date', 'time', 'timestamp', 'timestamptz', 'timetz', 'interval', 'json',
  'jsonb', 'uuid', 'bytea', 'geometry', 'geography', 'point', 'xml', 'money', 'inet', 'cidr', 'macaddr',
  'oid', 'regclass', 'regtype', 'tsvector', 'tsquery', 'bit', 'varbit', 'array',
]);

type TokenType = 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'text';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(sql: string): Token[] {
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_]+)/g;
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    if (m[1]) tokens.push({ type: 'comment', value: m[1] });
    else if (m[2]) tokens.push({ type: 'string', value: m[2] });
    else if (m[3]) tokens.push({ type: 'number', value: m[3] });
    else if (m[4]) {
      const up = m[4].toUpperCase();
      const low = m[4].toLowerCase();
      if (KEYWORDS.has(up)) tokens.push({ type: 'keyword', value: m[4] });
      else if (TYPES.has(low)) tokens.push({ type: 'type', value: m[4] });
      else tokens.push({ type: 'text', value: m[4] });
    } else if (m[5]) tokens.push({ type: 'text', value: m[5] });
    else tokens.push({ type: 'text', value: m[6] });
  }
  return tokens;
}

function styleFor(type: TokenType): CSSProperties {
  switch (type) {
    case 'keyword':
      return { color: 'var(--violet)' };
    case 'type':
      return { color: 'var(--cyan)' };
    case 'string':
      return { color: 'var(--amber)' };
    case 'number':
      return { color: 'var(--amber)' };
    case 'comment':
      return { color: 'var(--faint)', fontStyle: 'italic' };
    default:
      return { color: 'var(--text)' };
  }
}

export default function SqlView() {
  const store = useStore();
  const sel = store.selected;

  const defs = store.columns
    .map((c) => {
      let s = `  ${c.name} ${c.data_type}`;
      if (c.is_primary) s += ' PRIMARY KEY';
      if (c.not_null && !c.is_primary) s += ' NOT NULL';
      if (c.default_value) s += ` DEFAULT ${c.default_value}`;
      if (c.foreign_ref) s += ` REFERENCES ${c.foreign_ref}`;
      return s;
    })
    .join(',\n');

  const sql = `-- ${sel?.db}.${sel?.schema}.${sel?.table}\nCREATE TABLE ${sel?.schema}.${sel?.table} (\n${defs}\n);`;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <pre className="whitespace-pre font-mono text-[12.5px] leading-relaxed">
        {tokenize(sql).map((tok, i) => (
          <span key={i} style={styleFor(tok.type)}>
            {tok.value}
          </span>
        ))}
      </pre>
    </div>
  );
}
