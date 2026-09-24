import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Copy, Download } from 'lucide-react';
import { api } from '../api';
import { Button, Select, Loader } from './ui';
import { diffLines, type DiffLine } from '../lib/diff';
import { downloadText } from '../lib/export';

interface Side {
  db: string;
  schema: string; // '' = вся БД
}

const emptySide: Side = { db: '', schema: '' };

function SideSelector({
  label,
  value,
  onChange,
  dbs,
  schemas,
  onDbChange,
}: {
  label: string;
  value: Side;
  onChange: (s: Side) => void;
  dbs: { name: string; comment: string | null }[];
  schemas: string[];
  onDbChange: (db: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <Select
        value={value.db || null}
        onChange={(v) => v && onDbChange(v)}
        options={dbs.map((d) => ({ value: d.name, label: d.comment ? `${d.name} — ${d.comment}` : d.name }))}
        width={260}
        placeholder="База данных"
        searchable
      />
      <Select
        value={value.schema || null}
        onChange={(v) => onChange({ ...value, schema: v ?? '' })}
        options={[{ value: '', label: '— вся БД —' }, ...schemas.map((s) => ({ value: s, label: s }))]}
        width={260}
        placeholder="Схема"
        searchable
      />
    </div>
  );
}

export default function SchemaCompare({ id }: { id: string }) {
  const [dbs, setDbs] = useState<{ name: string; comment: string | null }[]>([]);
  const [left, setLeft] = useState<Side>(emptySide);
  const [right, setRight] = useState<Side>(emptySide);
  const [leftSchemas, setLeftSchemas] = useState<string[]>([]);
  const [rightSchemas, setRightSchemas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);

  useEffect(() => {
    api
      .databases(id)
      .then((d) => {
        setDbs(d);
        const first = d[0]?.name ?? '';
        setLeft((s) => ({ ...s, db: s.db || first }));
        setRight((s) => ({ ...s, db: s.db || first }));
      })
      .catch(() => toast.error('Не удалось загрузить список БД'));
  }, [id]);

  useEffect(() => {
    if (!left.db) {
      setLeftSchemas([]);
      return;
    }
    let on = true;
    api
      .schemas(id, left.db)
      .then((s) => on && setLeftSchemas(s.map((x) => x.name)))
      .catch(() => on && setLeftSchemas([]));
    return () => {
      on = false;
    };
  }, [id, left.db]);

  useEffect(() => {
    if (!right.db) {
      setRightSchemas([]);
      return;
    }
    let on = true;
    api
      .schemas(id, right.db)
      .then((s) => on && setRightSchemas(s.map((x) => x.name)))
      .catch(() => on && setRightSchemas([]));
    return () => {
      on = false;
    };
  }, [id, right.db]);

  async function compare() {
    if (!left.db || !right.db) return;
    setBusy(true);
    try {
      const [l, r] = await Promise.all([
        left.schema ? api.schemaDdl(id, left.db, left.schema) : api.databaseDdl(id, left.db),
        right.schema ? api.schemaDdl(id, right.db, right.schema) : api.databaseDdl(id, right.db),
      ]);
      setDiff(diffLines(l.ddl.split('\n'), r.ddl.split('\n')));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сравнить');
    } finally {
      setBusy(false);
    }
  }

  const added = diff ? diff.filter((d) => d.type === 'add').length : 0;
  const removed = diff ? diff.filter((d) => d.type === 'del').length : 0;

  function copyDiff() {
    if (!diff) return;
    const text = diff
      .map((d) => (d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  ') + d.text)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Скопировано'));
  }

  function downloadDiff() {
    if (!diff) return;
    const text = diff
      .map((d) => (d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  ') + d.text)
      .join('\n');
    downloadText(`ddl-diff-${left.db}${left.schema ? '.' + left.schema : ''}-vs-${right.db}${right.schema ? '.' + right.schema : ''}.txt`, text);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SideSelector
          label="Левая сторона"
          value={left}
          onChange={setLeft}
          dbs={dbs}
          schemas={leftSchemas}
          onDbChange={(db) => setLeft((s) => ({ ...s, db, schema: '' }))}
        />
        <SideSelector
          label="Правая сторона"
          value={right}
          onChange={setRight}
          dbs={dbs}
          schemas={rightSchemas}
          onDbChange={(db) => setRight((s) => ({ ...s, db, schema: '' }))}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={compare} disabled={busy || !left.db || !right.db}>
          <RefreshCw size={14} />
          {busy ? 'Сравнение…' : 'Сравнить'}
        </Button>
        {diff && (
          <>
            <span className="font-mono text-[12px]">
              <span className="text-[var(--accent)]">+{added}</span> /{' '}
              <span className="text-[var(--red)]">-{removed}</span>
            </span>
            <div className="flex-1" />
            <Button size="xs" variant="subtle" onClick={copyDiff}>
              <Copy size={12} />
              Копировать
            </Button>
            <Button size="xs" variant="subtle" onClick={downloadDiff}>
              <Download size={12} />
              Скачать
            </Button>
          </>
        )}
      </div>

      {diff === null ? (
        <div className="text-[12px] text-[var(--faint)]">
          Выберите две базы или две схемы и нажмите «Сравнить». Одинаковые объекты не подсвечиваются.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] font-mono text-[12px] leading-[1.4]">
          <div className="min-w-full">
            {diff.length === 0 ? (
              <div className="px-3 py-4 text-[var(--muted)]">DDL идентичны — различий нет.</div>
            ) : (
              diff.map((d, i) => (
                <div
                  key={i}
                  className={`flex whitespace-pre px-2 ${
                    d.type === 'add'
                      ? 'bg-[rgba(46,160,67,0.18)] text-[var(--accent)]'
                      : d.type === 'del'
                        ? 'bg-[rgba(248,81,73,0.15)] text-[var(--red)]'
                        : 'text-[var(--muted)]'
                  }`}
                >
                  <span className="w-5 shrink-0 select-none text-center">{d.type === 'add' ? '+' : d.type === 'del' ? '-' : ' '}</span>
                  <span>{d.text || ' '}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
