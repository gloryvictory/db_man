import { useStore } from '../store';

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
      <pre className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-[#e7eaf0]">{sql}</pre>
    </div>
  );
}
