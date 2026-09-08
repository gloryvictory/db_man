import { Router } from 'express';
import * as XLSX from 'xlsx';
import { getExportRows } from '../db';

const r = Router();

function cellForExcel(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function toCsv(columns: string[], rows: unknown[][]): string {
  const enc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [columns.map(enc).join(','), ...rows.map((r) => r.map(enc).join(','))].join('\n');
}

r.get('/:connId/databases/:db/schemas/:schema/tables/:table/export', async (req, res, next) => {
  try {
    const { format = 'xlsx', limit = '50000' } = req.query as Record<string, string | undefined>;
    const table = req.params.table;
    const { columns, rows } = await getExportRows(
      req.params.connId,
      req.params.db,
      req.params.schema,
      req.params.table,
      parseInt(limit, 10) || 50000
    );

    if (format === 'csv') {
      const csv = toCsv(columns, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
      return res.send('\ufeff' + csv);
    }

    const aoa = [columns, ...rows.map((r) => r.map(cellForExcel))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'data');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${table}.xlsx"`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

export default r;
