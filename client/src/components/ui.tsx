import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';
import { ChevronDown, X } from 'lucide-react';

/* ---------- Button ---------- */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'subtle' | 'light' | 'icon';
  size?: 'sm' | 'xs';
}

export function Button({ variant = 'default', size, className = '', ...props }: ButtonProps) {
  return <button className={`btn ${variant} ${size ?? ''} ${className}`.trim()} {...props} />;
}

/* ---------- Select ---------- */
export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  width = 200,
  searchable = false,
  dot,
  direction = 'down',
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  width?: number;
  searchable?: boolean;
  dot?: 'green' | 'gray' | 'processing';
  direction?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button type="button" className="select" onClick={() => setOpen((o) => !o)}>
        {dot && <span className={`dot ${dot}`} />}
        <span className={`flex-1 truncate text-left ${selected ? '' : 'text-[var(--faint)]'}`}>
          {selected?.label ?? placeholder ?? 'Выберите…'}
        </span>
        <ChevronDown size={12} className="shrink-0 text-[var(--muted)]" />
      </button>
      {open && (
        <div className={`select-menu ${direction === 'up' ? 'up' : ''}`}>
          {searchable && (
            <input
              autoFocus
              className="input mb-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск…"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 && <div className="select-empty">Ничего не найдено</div>}
            {filtered.map((o) => (
              <div
                key={o.value}
                className={`select-item ${o.value === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ('');
                }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  width = 440,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Field + Input ---------- */
export function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      {children}
      {description && <span className="field-desc">{description}</span>}
    </div>
  );
}

export function Input({
  className = '',
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { type?: string }) {
  return <input type={type} className={`input ${className}`.trim()} {...props} />;
}

/* ---------- Loader ---------- */
export function Loader({ size = 24 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size, borderWidth: Math.max(3, size / 9) }} />;
}

/* ---------- Tabs ---------- */
export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="tabs">
      {items.map((it) => (
        <button
          key={it.value}
          className={`tab ${it.value === value ? 'active' : ''}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({ kind, children }: { kind: 'pk' | 'fk' | 'kind'; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

/* ---------- Info (label + value) ---------- */
export function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--faint)]">{label}</div>
      <div className={`text-[12.5px] text-[var(--text)] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
