import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const SESSION_SECONDS = 60 * 60 * 24;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}
function signature(payload, password) {
  // Bind the signed session to the current password so password changes revoke it.
  return createHmac('sha256', secret()).update(payload).update('\0').update(password).digest();
}
export async function createSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url');
  const token = payload + '.' + signature(payload, user.password).toString('base64url');
  const store = await cookies();
  store.set({ name: 'user_session', value: token, httpOnly: true,
    secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS });
}
export async function getSessionUser() {
  const token = (await cookies()).get('user_session')?.value;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(claims?.id) || claims.id <= 0 || !Number.isSafeInteger(claims.exp) || claims.exp <= now || claims.exp > now + SESSION_SECONDS) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id } });
  if (!user) return null;
  const actual = Buffer.from(parts[1], 'base64url');
  const expected = signature(parts[0], user.password);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  // Never trust role/profile claims from the browser; use current database values.
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
export async function requireStaff(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Silakan login kembali.' }, { status: 401 });
  if (!['ADMIN', 'KASIR'].includes(user.role)) return NextResponse.json({ error: 'Akses staf diperlukan.' }, { status: 403 });
  const origin = request?.headers?.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Asal permintaan tidak diizinkan.' }, { status: 403 });
  return null;
}
