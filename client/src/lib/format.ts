export type ValueKind = 'null' | 'bool' | 'number' | 'json' | 'text';

export function formatValue(v: unknown): { text: string; kind: ValueKind } {
  if (v === null || v === undefined) return { text: 'NULL', kind: 'null' };
  if (typeof v === 'boolean') return { text: v ? 'true' : 'false', kind: 'bool' };
  if (typeof v === 'number') return { text: String(v), kind: 'number' };
  if (typeof v === 'object') return { text: JSON.stringify(v), kind: 'json' };
  return { text: String(v), kind: 'text' };
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function relativeLabel(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000); // >0 будущее, <0 прошлое

  if (days === 0) return 'сегодня';

  if (days > 0) {
    if (days === 1) return 'завтра';
    if (days === 2) return 'послезавтра';
    if (days < 7) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
    if (days < 30) return `через ${Math.floor(days / 7)} ${plural(Math.floor(days / 7), 'неделю', 'недели', 'недель')}`;
    if (days < 365) return `через ${Math.floor(days / 30)} ${plural(Math.floor(days / 30), 'месяц', 'месяца', 'месяцев')}`;
    return `через ${Math.floor(days / 365)} ${plural(Math.floor(days / 365), 'год', 'года', 'лет')}`;
  }

  const p = -days;
  if (p === 1) return 'вчера';
  if (p < 7) return `${p} ${plural(p, 'день', 'дня', 'дней')} назад`;
  if (p < 30) return `${Math.floor(p / 7)} ${plural(Math.floor(p / 7), 'неделю', 'недели', 'недель')} назад`;
  if (p < 365) return `${Math.floor(p / 30)} ${plural(Math.floor(p / 30), 'месяц', 'месяца', 'месяцев')} назад`;
  return `${Math.floor(p / 365)} ${plural(Math.floor(p / 365), 'год', 'года', 'лет')} назад`;
}

/** Абсолютная дата + относительная метка в скобках (сегодня/вчера/N назад). */
export function formatDateRel(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const rel = relativeLabel(s);
  return rel ? `${d.toLocaleString('ru-RU')} (${rel})` : d.toLocaleString('ru-RU');
}

/** Человекочитаемый размер в байтах. */
export function formatBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
