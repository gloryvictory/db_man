import { Router } from 'express';
import * as XLSX from 'xlsx';
import { listAudit, countAudit, clearAudit } from '../sqlite';

const r = Router();

r.get('/', (req, res) => {
  const q = req.query as Record<string, string>;
  const limit = Math.min(parseInt(q.limit, 10) || 100, 1000);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  const isAdmin = req.user!.role === 'admin';
  res.json({ rows: listAudit(limit, offset, req.user!.id, isAdmin), total: countAudit(req.user!.id, isAdmin), limit, offset });
});

function cell(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  return v;
}

function auditToRow(a: Record<string, unknown>) {
  return [a.created_at, a.username, a.action, a.target, a.detail, a.status, a.error];
}

r.get('/export', (req, res) => {
  const q = req.query as Record<string, string>;
  const format = q.format === 'csv' ? 'csv' : 'xlsx';
  const rows = listAudit(undefined, undefined, req.user!.id, req.user!.role === 'admin') as Record<string, unknown>[];
  const header = ['Время', 'Пользователь', 'Действие', 'Объект', 'Деталь', 'Результат', 'Ошибка'];
  const aoa = [header, ...rows.map(auditToRow)];

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  if (format === 'csv') {
    const enc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = aoa.map((r) => r.map(enc).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${stamp}.csv"`);
    return res.send('\ufeff' + csv);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa.map((r) => r.map(cell)));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'audit');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="audit-${stamp}.xlsx"`);
  res.send(buf);
});

r.delete('/', (req, res) => {
  clearAudit(req.user!.id, req.user!.role === 'admin');
  res.json({ ok: true });
});

export default r;
