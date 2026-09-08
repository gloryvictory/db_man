import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { Modal, Field, Input, Button } from './ui';

export default function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!store.activeConnId) return;
    setBusy(true);
    const ok = await store.connect(store.activeConnId, pwd);
    setBusy(false);
    if (ok) {
      setPwd('');
      onClose();
    } else {
      toast.error('Не удалось подключиться');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Требуется пароль" width={380}>
      <form onSubmit={submit} className="flex flex-col gap-3">
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
