import * as XLSX from 'xlsx';
import { api } from '../api';
import { downloadBlob } from './export';
import { formatBytes, formatDateRel } from './format';
import type { DatabaseInfo, DatabaseStats, DatabaseTableRow, DataQualityResult } from '../types';

export interface ReportKv {
  label: string;
  value: string;
}
export interface ReportTable {
  header: string[];
  rows: string[][];
}
export interface ReportSection {
  title: string;
  kind: 'kv' | 'table';
  kv?: ReportKv[];
  table?: ReportTable;
}
export interface Report {
  title: string;
  sections: ReportSection[];
}

function num(n: number): string {
  return n.toLocaleString('ru-RU');
}

function infoSection(info: DatabaseInfo): ReportSection {
  return {
    title: 'Информация',
    kind: 'kv',
    kv: [
      { label: 'База данных', value: info.name },
      { label: 'Владелец', value: info.owner },
      { label: 'Кодировка', value: info.encoding },
      { label: 'Collation', value: info.collation },
      { label: 'Ctype', value: info.ctype },
      {
        label: 'Лимит соединений',
        value: info.connection_limit === -1 ? 'без ограничений' : String(info.connection_limit),
      },
      { label: 'Размер всего', value: info.total_size },
      { label: 'Размер таблиц', value: info.tables_size },
      { label: 'Размер индексов', value: info.indexes_size },
      { label: 'Таблиц', value: num(info.table_count) },
      { label: 'Индексов', value: num(info.index_count) },
      { label: 'Схем', value: num(info.schema_count) },
      { label: 'Активных соединений', value: num(info.active_connections) },
    ],
  };
}

function serviceSection(stats: DatabaseStats | null): ReportSection {
  const hits =
    stats && stats.blks_hit + stats.blks_read > 0
      ? ((stats.blks_hit / (stats.blks_hit + stats.blks_read)) * 100).toFixed(1) + '%'
      : '—';
  return {
    title: 'Сервис',
    kind: 'kv',
    kv: [
      { label: 'Соединений', value: num(stats?.numbackends ?? 0) },
      { label: 'Транзакций (commit)', value: num(stats?.xact_commit ?? 0) },
      { label: 'Транзакций (rollback)', value: num(stats?.xact_rollback ?? 0) },
      { label: 'Deadlocks', value: num(stats?.deadlocks ?? 0) },
      { label: 'Блоков прочитано', value: num(stats?.blks_read ?? 0) },
      { label: 'Блоков из кэша', value: num(stats?.blks_hit ?? 0) },
      { label: 'Попадание в кэш', value: hits },
      { label: 'Строк возвращено', value: num(stats?.tup_returned ?? 0) },
      { label: 'Строк выбрано', value: num(stats?.tup_fetched ?? 0) },
      { label: 'Строк вставлено', value: num(stats?.tup_inserted ?? 0) },
      { label: 'Строк обновлено', value: num(stats?.tup_updated ?? 0) },
      { label: 'Строк удалено', value: num(stats?.tup_deleted ?? 0) },
      { label: 'Конфликтов', value: num(stats?.conflicts ?? 0) },
      { label: 'Временных файлов', value: num(stats?.temp_files ?? 0) },
      { label: 'Объём temp', value: formatBytes(stats?.temp_bytes ?? 0) },
      { label: 'Сброс статистики', value: formatDateRel(stats?.stats_reset ?? null) },
    ],
  };
}

function analysisTable(rows: DatabaseTableRow[]): ReportTable {
  return {
    header: [
      'Схема',
      'Имя таблицы',
      'Тип',
      'Комментарий',
      'Колонок',
      'Строк (оценка)',
      'Таблица',
      'Индексы',
      'Всего',
      'Bloat %',
      'Мёртвых строк',
      'Неисп. индексы',
      'Дубл. индексы',
      'VACUUM',
      'ANALYZE',
    ],
    rows: rows.map((r) => [
      r.schema,
      r.name,
      r.kind,
      r.comment ?? '',
      num(r.column_count),
      num(r.row_estimate),
      formatBytes(r.table_size),
      formatBytes(r.indexes_size),
      formatBytes(r.total_size),
      r.dead_ratio > 0 ? (r.dead_ratio * 100).toFixed(1) + '%' : '—',
      num(r.dead_tup),
      String(r.unused_index_count || '—'),
      String(r.duplicate_index_count || '—'),
      formatDateRel(r.last_vacuum),
      formatDateRel(r.last_analyze),
    ]),
  };
}

export async function buildOverviewReport(id: string, db: string): Promise<Report> {
  const [info, stats, analysis] = await Promise.all([
    api.databaseInfo(id, db),
    api.databaseStats(id, db),
    api.databaseAnalysis(id, db),
  ]);
  return {
    title: `Общая информация — ${db}`,
    sections: [
      infoSection(info),
      serviceSection(stats),
      { title: 'Анализ таблиц', kind: 'table', table: analysisTable(analysis) },
    ],
  };
}

export async function buildQualityReport(id: string, db: string): Promise<Report> {
  const q: DataQualityResult = await api.databaseDataQuality(id, db);
  return {
    title: `Качество данных — ${db}`,
    sections: [
      {
        title: 'Таблицы без Пространственного индекса',
        kind: 'table',
        table: {
          header: ['Схема', 'Имя таблицы', 'Геометрия (колонки)'],
          rows: q.spatial.map((r) => [r.schema, r.name, (r.geom_columns ?? []).join(', ')]),
        },
      },
      {
        title: 'Таблицы без индексов',
        kind: 'table',
        table: {
          header: ['Схема', 'Имя таблицы', 'Тип', 'Комментарий', 'Колонок', 'Строк (оценка)', 'Размер таблицы'],
          rows: q.noIndex.map((r) => [
            r.schema,
            r.name,
            r.kind,
            r.comment ?? '',
            num(r.column_count),
            num(r.row_estimate),
            formatBytes(r.table_size),
          ]),
        },
      },
    ],
  };
}

export async function buildConfigReport(id: string, db: string): Promise<Report> {
  const rows = await api.databaseConfig(id, db);
  return {
    title: `Конфигурация — ${db}`,
    sections: [
      {
        title: 'Конфигурация',
        kind: 'table',
        table: {
          header: ['Параметр', 'Значение'],
          rows: rows.map((r) => [r.name, r.value]),
        },
      },
    ],
  };
}

function sheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Лист';
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_');
}

export function exportReportExcel(report: Report): void {
  const wb = XLSX.utils.book_new();
  for (const s of report.sections) {
    let aoa: unknown[][];
    if (s.kind === 'kv' && s.kv) {
      aoa = [['Параметр', 'Значение'], ...s.kv.map((k) => [k.label, k.value])];
    } else if (s.table) {
      aoa = [s.table.header, ...s.table.rows];
    } else {
      continue;
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(s.title));
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeFilename(report.title)}.xlsx`
  );
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function exportReportHtml(report: Report): void {
  const sections = report.sections
    .map((s) => {
      let inner = '';
      if (s.kind === 'kv' && s.kv) {
        inner =
          '<table>' +
          s.kv.map((k) => `<tr><td class="k">${esc(k.label)}</td><td>${esc(k.value)}</td></tr>`).join('') +
          '</table>';
      } else if (s.table) {
        inner =
          '<table><thead><tr>' +
          s.table.header.map((h) => `<th>${esc(h)}</th>`).join('') +
          '</tr></thead><tbody>' +
          s.table.rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>';
      }
      return `<section><h2>${esc(s.title)}</h2>${inner}</section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${esc(report.title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #666; margin: 22px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; font-family: Consolas, Menlo, monospace; }
  th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  td.k { color: #666; width: 260px; }
</style>
</head>
<body>
<h1>${esc(report.title)}</h1>
${sections}
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeFilename(report.title)}.html`);
}
