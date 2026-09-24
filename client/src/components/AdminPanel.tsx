import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Download, Upload, Info, Users, Database, Settings } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import { Modal, Button, Field, Input, Select, Loader } from './ui';
import { downloadText } from '../lib/export';
import { getTheme, applyTheme, type Theme } from '../lib/theme';
import type { User, AdminExport } from '../types';

type Category = 'general' | 'users' | 'connections' | 'settings';

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

const ABOUT = {
  version: '1.0.0',
  author: 'Замараев Вячеслав Викторович',
  email: 'zamaraev@gmail.com',
  release: '22.09.2026',
  repo: 'https://github.com/gloryvictory/db_man',
};

const CATEGORIES: { key: Category; label: string; icon: ReactNode }[] = [
  { key: 'general', label: 'Общее', icon: <Info size={14} /> },
  { key: 'users', label: 'Пользователи', icon: <Users size={14} /> },
  { key: 'connections', label: 'Подключения', icon: <Database size={14} /> },
  { key: 'settings', label: 'Настройки', icon: <Settings size={14} /> },
];

export default function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState<Category>('general');
  const store = useStore();

  // пользователи
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
        await api.updateUser(editId, { fio: form.fio, password: form.password || undefined, role: form.role });
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

  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    try {
      const data = await api.adminExport();
      downloadText(`dbman-admin-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
      toast.success('Экспортировано в JSON');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось экспортировать');
    }
  }

  async function doImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as AdminExport;
      const r = await api.adminImport(data);
      toast.success(`Импортировано: пользователей ${r.users}, подключений ${r.connections}, паролей ${r.secrets}, заданий ${r.jobs}`);
      await load();
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Не удалось импортировать');
    } finally {
      e.target.value = '';
    }
  }

  async function removeConnection(id: string) {
    const c = store.connections.find((x) => x.id === id);
    if (!window.confirm(`Удалить подключение «${c?.name ?? id}»?`)) return;
    try {
      await store.removeConnection(id);
      toast.success('Подключение удалено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  const [theme, setTheme] = useState<Theme>(getTheme());
  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return (
    <Modal open={open} onClose={onClose} title="Админка" width={820}>
      <div className="flex min-h-[460px] overflow-hidden rounded-lg border border-[var(--border)]">
        {/* левая панель — категории */}
        <nav className="w-[176px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-panel)] p-2">
          <div className="flex flex-col gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] ${
                  category === c.key ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span className="shrink-0">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* правая панель — содержимое категории */}
        <div className="min-w-0 flex-1 overflow-auto bg-[var(--bg)] p-4">
          {category === 'general' ? (
            <div className="flex flex-col gap-4">
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Информация</h2>
                <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 text-[13px]">
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Версия</span><span className="font-mono">{ABOUT.version}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Автор</span><span>{ABOUT.author}</span></div>
                  <div className="flex justify-between gap-3"><span className="shrink-0 text-[var(--muted)]">Email</span><span className="font-mono">{ABOUT.email}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Релиз</span><span className="font-mono">{ABOUT.release}</span></div>
                  <div className="flex justify-between gap-3"><span className="shrink-0 text-[var(--muted)]">Проект</span><a href={ABOUT.repo} target="_blank" rel="noreferrer" className="break-all text-right font-mono text-[var(--accent)] hover:underline">{ABOUT.repo}</a></div>
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Резервная копия</h2>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Button size="xs" variant="subtle" onClick={doExport}>
                      <Download size={12} />
                      Экспорт JSON
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => fileRef.current?.click()}>
                      <Upload size={12} />
                      Импорт JSON
                    </Button>
                    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
                  </div>
                  <div className="text-[11px] text-[var(--faint)]">
                    Экспорт включает пользователей, подключения, сохранённые пароли и задания обслуживания. Пароли хранятся в файле в открытом виде.
                  </div>
                </div>
              </section>
            </div>
          ) : category === 'users' ? (
            <div className="flex flex-col gap-3">
              <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{editId ? 'Изменить пользователя' : 'Новый пользователь'}</span>
                  {editId && (
                    <button type="button" className="text-[12px] text-[var(--muted)] hover:text-[var(--text)]" onClick={cancelEdit}>
                      Отмена
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="ФИО">
                    <Input required value={form.fio} onChange={(e) => setForm({ ...form, fio: e.target.value })} placeholder="Иванов Иван" />
                  </Field>
                  <Field label="Логин">
                    <Input required disabled={!!editId} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
                  </Field>
                  <Field label={editId ? 'Пароль (пусто — не менять)' : 'Пароль'}>
                    <Input required={!editId} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                </div>
                <div className="flex items-end justify-between">
                  <Field label="Роль">
                    <Select width={180} value={form.role} onChange={(v) => v && setForm({ ...form, role: v as 'admin' | 'user' })} options={ROLE_OPTIONS} />
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
                <div className="max-h-[320px] overflow-auto rounded-lg border border-[var(--border)]">
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
            </div>
          ) : category === 'connections' ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Подключения ({store.connections.length})
              </div>
              <div className="overflow-auto rounded-lg border border-[var(--border)]">
                <table className="w-full border-collapse font-mono text-[12px]">
                  <thead>
                    <tr className="bg-[var(--surface)] text-left">
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Название</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Подключение</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">База</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 font-medium text-[var(--muted)]">Пароль сохранён</th>
                      <th className="border-b border-[var(--border-strong)] px-3 py-2 text-right font-medium text-[var(--muted)]">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.connections.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-[var(--null)]">Подключений нет</td>
                      </tr>
                    ) : (
                      store.connections.map((c) => (
                        <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                          <td className="px-3 py-1.5 text-[var(--text)]">{c.name}</td>
                          <td className="px-3 py-1.5 text-[var(--text)]">{c.host}:{c.port}@{c.username}</td>
                          <td className="px-3 py-1.5 text-[var(--amber)]">{c.database}</td>
                          <td className="px-3 py-1.5">
                            {c.hasSavedPassword ? <span className="text-[var(--accent)]">да</span> : <span className="text-[var(--faint)]">нет</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Button size="xs" variant="subtle" title="Удалить" onClick={() => removeConnection(c.id)} style={{ color: 'var(--red)' }}>
                              <Trash2 size={12} />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Тема оформления</h2>
                <div className="flex gap-2">
                  <Button variant={theme === 'dark' ? 'primary' : 'subtle'} onClick={() => changeTheme('dark')}>
                    Тёмная
                  </Button>
                  <Button variant={theme === 'light' ? 'primary' : 'subtle'} onClick={() => changeTheme('light')}>
                    Светлая
                  </Button>
                </div>
                <div className="mt-2 text-[11px] text-[var(--faint)]">Выбор сохраняется и применяется сразу.</div>
              </section>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
