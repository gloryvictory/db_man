import { Router } from 'express';
import { listUsers, createUser, updateUser, deleteUser, getUserById, hashPassword } from '../sqlite';
import { requireAuth, requireAdmin } from '../auth';

const r = Router();
r.use(requireAuth, requireAdmin);

r.get('/', (_req, res) => {
  res.json(listUsers());
});

r.post('/', (req, res) => {
  const { fio, login, password, role } = (req.body ?? {}) as Record<string, unknown>;
  if (!fio || !login || !password) {
    return res.status(400).json({ error: 'Заполните ФИО, логин и пароль' });
  }
  const l = String(login).trim();
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }
  const u = createUser(String(fio).trim(), l, hashPassword(String(password)), role === 'admin' ? 'admin' : 'user');
  res.status(201).json(u);
});

r.put('/:id', (req, res) => {
  const { fio, password, role } = (req.body ?? {}) as Record<string, unknown>;
  const cur = getUserById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Пользователь не найден' });

  const data: { fio?: string; passwordHash?: string; role?: 'admin' | 'user' } = {};
  if (typeof fio === 'string' && fio.trim()) data.fio = fio.trim();
  if (typeof password === 'string' && password) data.passwordHash = hashPassword(password);
  if (role === 'admin' || role === 'user') data.role = role;

  const u = updateUser(req.params.id, data);
  res.json(u);
});

r.delete('/:id', (req, res) => {
  const cur = getUserById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Пользователь не найден' });
  if (cur.role === 'admin') {
    const admins = listUsers().filter((u) => u.role === 'admin');
    if (admins.length <= 1) return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
  }
  deleteUser(req.params.id);
  res.json({ ok: true });
});

export default r;
