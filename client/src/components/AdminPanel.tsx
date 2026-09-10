import { useCallback, useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Modal, Button, Field, Input, Select, Loader } from './ui';
import type { User } from '../types';

interface FormState {
  fio: string;
  login: string;
  password: string;
  role: 'admin' | 'user';
}

const emptyForm: FormState = { fio: '', login: '', password: '', role: 'user' };

const ROLE_OPTIONS = [
  { value: 'user', label: 'Пользователь' },
  { value: 'admin', label: 'Администратор' },
];

export default function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function startEdit(u: User) {
    setEditId(u.id);
    setForm({ fio: u.fio, login: u.login, password: '', role: u.role });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editId) {
        await api.updateUser(editId, {
          fio: form.fio,
          password: form.password || undefined,
          role: form.role,
        });
        toast.success('Пользователь обновлён');
      } else {
        await api.createUser({ fio: form.fio, login: form.login, password: form.password, role: form.role });
        toast.success('Пользователь создан');
      }
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: User) {
    if (!window.confirm(`Удалить пользователя «${u.fio}» (${u.login})?`)) return;
    try {
      await api.deleteUser(u.id);
      toast.success('Пользователь удалён');
      if (editId === u.id) cancelEdit();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Админка — пользователи" width={720}>
      <form
        onSubmit={submit}
        className="mb-4 flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">
            {editId ? 'Изменить пользователя' : 'Новый пользователь'}
          </span>
          {editId && (
            <button
              type="button"
              className="text-[12px] text-[var(--muted)] hover:text-[var(--text)]"
              onClick={cancelEdit}
            >
              Отмена
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="ФИО">
            <Input
              required
              value={form.fio}
              onChange={(e) => setForm({ ...form, fio: e.target.value })}
              placeholder="Иванов Иван"
            />
          </Field>
          <Field label="Логин">
            <Input
              required
              disabled={!!editId}
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
          </Field>
          <Field label={editId ? 'Пароль (пусто — не менять)' : 'Пароль'}>
            <Input
              required={!editId}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex items-end justify-between">
          <Field label="Роль">
            <Select
              width={180}
              value={form.role}
              onChange={(v) => v && setForm({ ...form, role: v as 'admin' | 'user' })}
              options={ROLE_OPTIONS}
            />
          </Field>
          <Button variant="primary" type="submit" disabled={busy}>
            <Plus size={14} />
            {editId ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="grid h-[200px] place-items-center">
          <Loader />
        </div>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="sticky top-0 bg-[var(--bg-raised)] text-left text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">ФИО</th>
                <th className="px-3 py-2 font-medium">Логин</th>
                <th className="px-3 py-2 font-medium">Роль</th>
                <th className="w-[84px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{u.fio}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">{u.login}</td>
                  <td className="px-3 py-2">
                    <span className={u.role === 'admin' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}>
                      {u.role === 'admin' ? 'Администратор' : 'Пользователь'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="icon" title="Изменить" onClick={() => startEdit(u)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="icon" title="Удалить" onClick={() => remove(u)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
