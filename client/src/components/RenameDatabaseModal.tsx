import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Modal, Field, Input, Button } from './ui';
import { useStore } from '../store';

export default function RenameDatabaseModal({
  open,
  db,
  onClose,
}: {
  open: boolean;
  db: string | null;
  onClose: () => void;
}) {
  const store = useStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open, db]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!db || !name.trim()) return;
    setBusy(true);
    try {
      await store.renameDatabase(db, name.trim());
      toast.success(`База данных переименована в «${name.trim()}»`);
      setName('');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Переименовать базу данных" width={420}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-[12px]">
          <span className="text-[var(--muted)]">Текущее имя: </span>
          <span className="font-mono text-[var(--text)]">{db}</span>
        </div>
        <Field label="Новое имя" description="Все подключения к базе будут разорваны">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="my_db_new" />
        </Field>
        <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Переименование…' : 'Переименовать'}
        </Button>
      </form>
    </Modal>
  );
}
