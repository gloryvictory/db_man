import { Router } from 'express';
import { hashPassword, verifyPassword, getUserByLogin, createUser, createSession, deleteSession } from '../sqlite';
import { newToken, cookieHeader, clearCookieHeader, parseCookies, requireAuth, COOKIE_NAME } from '../auth';
import type { User } from '../sqlite';

const r = Router();

function publicUser(u: User & { password_hash?: string }): User {
  const { password_hash: _ph, ...rest } = u;
  return rest;
}

function setSession(res: { setHeader: (k: string, v: string) => void }, userId: string): void {
  const token = newToken();
  createSession(token, userId);
  res.setHeader('Set-Cookie', cookieHeader(token));
}

r.post('/login', (req, res) => {
  const { login, password } = (req.body ?? {}) as Record<string, unknown>;
  if (!login || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }
  const u = getUserByLogin(String(login));
  if (!u || !verifyPassword(String(password), u.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  setSession(res, u.id);
  res.json({ user: publicUser(u) });
});

r.post('/register', (req, res) => {
  const { fio, login, password } = (req.body ?? {}) as Record<string, unknown>;
  if (!fio || !login || !password) {
    return res.status(400).json({ error: 'Заполните ФИО, логин и пароль' });
  }
  const l = String(login).trim();
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }
  if (getUserByLogin(l)) {
    return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
  }
  const u = createUser(String(fio).trim(), l, hashPassword(String(password)), 'user');
  setSession(res, u.id);
  res.status(201).json({ user: publicUser(u) });
});

r.post('/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) deleteSession(token);
  res.setHeader('Set-Cookie', clearCookieHeader());
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default r;
