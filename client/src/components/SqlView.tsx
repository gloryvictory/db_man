import toast from 'react-hot-toast';
import { Copy, Download } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui';
import { SqlCode } from '../lib/sqlHighlight';
import { downloadText } from '../lib/export';

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

  function copySql() {
    navigator.clipboard.writeText(sql).then(() => toast.success('Скопировано'));
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <Button size="xs" variant="subtle" onClick={copySql}>
          <Copy size={12} />
          Скопировать
        </Button>
        <Button size="xs" variant="subtle" onClick={() => downloadText(`${sel?.table ?? 'table'}.sql`, sql)}>
          <Download size={12} />
          Экспорт
        </Button>
      </div>
      <SqlCode sql={sql} />
    </div>
  );
}
