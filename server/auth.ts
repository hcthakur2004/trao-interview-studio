import type { NextFunction, Request, Response } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Store } from './store';
export type User = { id: string; name: string; email: string; password: string };
type Session = { id: string; userId: string; expiresAt: Date | string };
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, raw] = hash.split(':');
  if (!salt || !raw) return false;
  const expected = Buffer.from(raw, 'hex');
  const actual = await derive(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function sessionId(req: Request) {
  const value = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('studio_session='))
    ?.slice('studio_session='.length);
  return value ? digest(value) : undefined;
}
export async function createSession(store: Store, res: Response, userId: string) {
  const token = randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  await store.insert('sessions', {
    id: digest(token),
    userId,
    expiresAt: new Date(Date.now() + maxAge),
  } as Session);
  res.cookie('studio_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}
export function authenticate(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = sessionId(req);
    const session = id ? await store.get<Session>('sessions', id) : null;
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      if (id) await store.remove('sessions', id);
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue.' } });
      return;
    }
    const user = await store.get<User>('users', session.userId);
    if (!user) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'This session is no longer valid.' } });
      return;
    }
    res.locals.user = user;
    next();
  };
}
