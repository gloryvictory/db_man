import { Router } from 'express';
import * as XLSX from 'xlsx';
import { listLogs, countLogs } from '../sqlite';

const r = Router();

r.get('/', (req, res) => {
  const q = req.query as Record<string, string>;
  const limit = Math.min(parseInt(q.limit, 10) || 100, 1000);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  res.json({ rows: listLogs(limit, offset), total: countLogs(), limit, offset });
});

function cell(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  return v;
}

function logToRow(l: Record<string, unknown>) {
  return [
    l.created_at,
    l.host,
    l.port,
    l.database,
    l.username,
    l.dsn,
    l.query,
    l.error,
    l.rows,
    l.duration_ms,
  ];
}

r.get('/export', (req, res) => {
  const q = req.query as Record<string, string>;
  const format = q.format === 'csv' ? 'csv' : 'xlsx';
  // если указаны limit/offset — выгружаем страницу, иначе — весь журнал
  const isPage = q.limit !== undefined;
  const limit = isPage ? Math.min(parseInt(q.limit, 10) || 100, 100000) : undefined;
  const offset = isPage ? Math.max(parseInt(q.offset, 10) || 0, 0) : undefined;

  const rows = listLogs(limit, offset) as Record<string, unknown>[];
  const header = ['Время', 'Сервер', 'Порт', 'БД', 'Пользователь', 'DSN', 'Запрос', 'Ошибка', 'Строк', 'мс'];
  const aoa = [header, ...rows.map(logToRow)];

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  if (format === 'csv') {
    const enc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = aoa.map((r) => r.map(enc).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="query-log-${stamp}.csv"`);
    return res.send('\ufeff' + csv);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map(cell)));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'log');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="query-log-${stamp}.xlsx"`);
  res.send(buf);
});

export default r;
