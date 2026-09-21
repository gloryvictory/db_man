import { useState } from 'react';
import { useStore } from '../store';
import { Modal, Field, Input, Button } from './ui';

export default function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const conn = store.connections.find((c) => c.id === store.activeConnId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store.activeConnId) return;
    setBusy(true);
    const ok = await store.connect(store.activeConnId, pwd);
    setBusy(false);
    if (ok) {
      setPwd('');
      onClose();
    }
    // при ошибке store.connect уже показал причину — модалка остаётся открытой для повтора
  }

  return (
    <Modal open={open} onClose={onClose} title="Требуется пароль" width={380}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {conn && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-[12px] leading-relaxed">
            <div>
              <span className="text-[var(--muted)]">Подключение: </span>
              <span className="text-[var(--text)]">{conn.name}</span>
              <span className="text-[var(--muted)]">
                {' '}· {conn.host}:{conn.port}/{conn.database}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Логин: </span>
              <span className="font-mono text-[var(--text)]">{conn.username}</span>
            </div>
          </div>
        )}
        <Field label="Пароль">
          <Input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </Field>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Подключение…' : 'Подключить'}
        </Button>
      </form>
    </Modal>
  );
}
