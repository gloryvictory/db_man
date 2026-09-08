export type ValueKind = 'null' | 'bool' | 'number' | 'json' | 'text';

export function formatValue(v: unknown): { text: string; kind: ValueKind } {
  if (v === null || v === undefined) return { text: 'NULL', kind: 'null' };
  if (typeof v === 'boolean') return { text: v ? 'true' : 'false', kind: 'bool' };
  if (typeof v === 'number') return { text: String(v), kind: 'number' };
  if (typeof v === 'object') return { text: JSON.stringify(v), kind: 'json' };
  return { text: String(v), kind: 'text' };
}
