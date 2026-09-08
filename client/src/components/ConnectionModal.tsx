import { useState } from 'react';
import { Modal, TextInput, NumberInput, PasswordInput, Button, Stack } from '@mantine/core';
import toast from 'react-hot-toast';
import { useStore } from '../store';

const empty = {
  name: '',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
};

export default function ConnectionModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const store = useStore();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await store.addConnection({
      name: form.name,
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password || undefined,
    });
    setSaving(false);

    if (res.ok && res.connected) {
      toast.success('Подключено');
      onClose();
      setForm(empty);
    } else if (res.ok) {
      toast.error(`Подключение не удалось: ${res.error || 'неизвестная ошибка'}`);
      onClose();
      setForm(empty);
    } else {
      toast.error(res.error || 'Ошибка сохранения');
    }
  }

  const set = (k: keyof typeof empty) => (v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal opened={opened} onClose={onClose} title="Новое подключение" centered>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <TextInput
            label="Название"
            placeholder="Локальная база"
            required
            value={form.name}
            onChange={(e) => set('name')(e.currentTarget.value)}
          />
          <div className="flex gap-2">
            <TextInput
              label="Хост"
              className="flex-1"
              required
              value={form.host}
              onChange={(e) => set('host')(e.currentTarget.value)}
            />
            <NumberInput
              label="Порт"
              w={90}
              min={1}
              max={65535}
              value={form.port}
              onChange={(v) => set('port')(Number(v) || 5432)}
            />
          </div>
          <TextInput
            label="База данных"
            required
            value={form.database}
            onChange={(e) => set('database')(e.currentTarget.value)}
          />
          <TextInput
            label="Пользователь"
            required
            value={form.username}
            onChange={(e) => set('username')(e.currentTarget.value)}
          />
          <PasswordInput
            label="Пароль"
            description="Хранится только в памяти сервера, не сохраняется на диск"
            value={form.password}
            onChange={(e) => set('password')(e.currentTarget.value)}
          />
          <Button type="submit" loading={saving}>
            Добавить и подключить
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
