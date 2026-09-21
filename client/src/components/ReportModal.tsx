import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileCode } from 'lucide-react';
import { Modal, Button, Loader } from './ui';
import {
  buildOverviewReport,
  buildQualityReport,
  exportReportExcel,
  exportReportHtml,
  type Report,
} from '../lib/report';

export type ReportType = 'overview' | 'quality';

export default function ReportModal({
  open,
  onClose,
  type,
  id,
  db,
}: {
  open: boolean;
  onClose: () => void;
  type: ReportType | null;
  id: string | null;
  db: string | null;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !type || !id || !db) return;
    let cancelled = false;
    setLoading(true);
    setReport(null);
    (async () => {
      try {
        const r = type === 'overview' ? await buildOverviewReport(id, db) : await buildQualityReport(id, db);
        if (!cancelled) setReport(r);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, type, id, db]);

  return (
    <Modal open={open} onClose={onClose} title={report?.title ?? 'Отчёт'} width={920}>
      <div className="mb-3 flex items-center gap-2">
        <Button size="xs" variant="subtle" disabled={!report} onClick={() => report && exportReportExcel(report)}>
          <FileSpreadsheet size={13} />
          Экспорт в Excel
        </Button>
        <Button size="xs" variant="subtle" disabled={!report} onClick={() => report && exportReportHtml(report)}>
          <FileCode size={13} />
          Экспорт в HTML
        </Button>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center">
          <Loader />
        </div>
      ) : report ? (
        <div className="flex max-h-[62vh] flex-col gap-5 overflow-auto pr-1">
          {report.sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {s.title}
              </h2>
              {s.kind === 'kv' && s.kv ? (
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <tbody>
                      {s.kv.map((k, j) => (
                        <tr key={j} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="w-64 px-3 py-1.5 text-[var(--muted)]">{k.label}</td>
                          <td className="px-3 py-1.5 text-[var(--text)]">{k.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : s.table ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full border-collapse font-mono text-[12px]">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        {s.table.header.map((h, j) => (
                          <th
                            key={j}
                            className="whitespace-nowrap border-b border-[var(--border-strong)] px-3 py-1.5 text-left font-medium text-[var(--muted)]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((row, j) => (
                        <tr key={j} className="border-b border-[var(--border)] last:border-b-0">
                          {row.map((cell, k) => (
                            <td key={k} className="whitespace-nowrap px-3 py-1.5 text-[var(--text)]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {s.table.rows.length === 0 && (
                        <tr>
                          <td colSpan={s.table.header.length} className="px-3 py-3 text-center text-[var(--null)]">
                            Нет данных
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
