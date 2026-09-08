import { useState } from 'react';
import { Modal, PasswordInput, Button, Stack } from '@mantine/core';
import toast from 'react-hot-toast';
import { useStore } from '../store';

export default function PasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
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
    <Modal opened={opened} onClose={onClose} title="Требуется пароль" centered>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <PasswordInput
            label="Пароль"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.currentTarget.value)}
          />
          <Button type="submit" loading={busy}>
            Подключить
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
