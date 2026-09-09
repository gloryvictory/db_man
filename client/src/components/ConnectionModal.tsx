import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { Modal, Field, Input, Button } from './ui';

const empty = {
  name: '',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
  savePassword: false,
};

export default function ConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      savePassword: form.savePassword,
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

  return (
    <Modal open={open} onClose={onClose} title="Новое подключение" width={460}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Название">
          <Input
            required
            placeholder="Локальная база"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Хост">
              <Input
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </Field>
          </div>
          <div className="w-[92px]">
            <Field label="Порт">
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 5432 })}
              />
            </Field>
          </div>
        </div>
        <Field label="База данных">
          <Input
            required
            value={form.database}
            onChange={(e) => setForm({ ...form, database: e.target.value })}
          />
        </Field>
        <Field label="Пользователь">
          <Input
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Пароль" description="По умолчанию хранится только в памяти сервера">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[var(--muted)]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)]"
            checked={form.savePassword}
            onChange={(e) => setForm({ ...form, savePassword: e.target.checked })}
          />
          Сохранить пароль для автоматического подключения
        </label>
        <Button variant="primary" type="submit" disabled={saving} className="mt-1">
          {saving ? 'Подключение…' : 'Добавить и подключить'}
        </Button>
      </form>
    </Modal>
  );
}
