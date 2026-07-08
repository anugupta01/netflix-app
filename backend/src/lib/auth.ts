import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { Session } from '../models/Session';
import { env } from '../config/env';
import type { Role } from '../models/User';

// --- Password hashing --------------------------------------------------
// Bun.password uses Argon2id by default — do not swap this for a plain
// SHA/MD5 hash or a hand-rolled scheme. Argon2id is deliberately slow and
// memory-hard, which is what makes offline brute-forcing of a leaked DB
// impractical.
export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Bun.password.verify(plain, hash);
}

// --- Password strength ---------------------------------------------------
// Enforced server-side, not just in the frontend form — a client-side-only
// check can always be bypassed by calling the API directly.
export function isPasswordStrongEnough(pw: string): boolean {
  if (pw.length < 10) return false;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  return [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length >= 3;
}

// --- Refresh token opaque strings ----------------------------------------
// The refresh token given to the client is a random opaque string, NOT a JWT.
// Only its SHA-256 hash is stored in Mongo (Session.refreshTokenHash) — so a
// leaked database dump alone can never be replayed as a valid refresh token.
export function generateOpaqueToken(): string {
  return nanoid(64);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  sid: string; // session id, so an access token can be tied back to a specific device/session
}

export async function createSession(params: {
  userId: string;
  userAgent: string;
  ip: string;
}) {
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  const session = await Session.create({
    userId: params.userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: params.userAgent,
    ip: params.ip,
    expiresAt
  });

  return { session, refreshToken };
}

// Rotates a refresh token: issues a new one, marks the old session as
// consumed (replacedBy), and returns the new pair. If the OLD token is ever
// presented again after this point, that's a signal of token theft (someone
// replayed a stolen/already-used token) — callers must treat that as a
// reuse-detection event and revoke the entire session family.
export async function rotateSession(oldSession: { _id: any; userId: any }, params: { userAgent: string; ip: string }) {
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  const newSession = await Session.create({
    userId: oldSession.userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: params.userAgent,
    ip: params.ip,
    expiresAt
  });

  await Session.findByIdAndUpdate(oldSession._id, {
    isRevoked: true,
    replacedBy: newSession._id
  });

  return { session: newSession, refreshToken };
}

export async function revokeAllSessionsForUser(userId: string) {
  await Session.updateMany({ userId, isRevoked: false }, { isRevoked: true });
}
