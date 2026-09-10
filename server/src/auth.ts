import type { NextFunction, Request, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { getSessionUser } from './sqlite';
import type { User } from './sqlite';

export const COOKIE_NAME = 'dbman_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 3600;

const als = new AsyncLocalStorage<{ user: User }>();

export function currentUser(): User | undefined {
  return als.getStore()?.user;
}

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Требуется вход' });
    return;
  }
  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: 'Сессия истекла' });
    return;
  }
  req.user = user;
  als.run({ user }, () => next());
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Нужны права администратора' });
    return;
  }
  next();
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function cookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
