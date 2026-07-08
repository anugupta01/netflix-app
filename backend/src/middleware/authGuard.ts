import { Elysia } from 'elysia';
import jwt from '@elysiajs/jwt';
import { env } from '../config/env';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { Errors } from '../lib/errors';
import type { AccessTokenPayload } from '../lib/auth';

// Reusable Elysia plugin: decodes and verifies the access token, then loads
// the live user + session state from the DB so revocation and deactivation
// take effect immediately — not just when the (short-lived) access token
// naturally expires.
export const jwtAccess = new Elysia().use(
  jwt({
    name: 'jwtAccess',
    secret: env.jwtAccessSecret,
    exp: env.accessTokenTtl
  })
);

export const authGuard = new Elysia()
  .use(jwtAccess)
  .derive({ as: 'scoped' }, async ({ headers, jwtAccess }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw Errors.unauthorized();
    }
    const token = authHeader.slice('Bearer '.length).trim();

    const payload = (await jwtAccess.verify(token)) as AccessTokenPayload | false;
    if (!payload) {
      // elysia/jwt returns false both for expired and malformed tokens;
      // we deliberately don't distinguish further to avoid leaking
      // signature-validity details to a would-be attacker.
      throw Errors.tokenExpired();
    }

    const [user, session] = await Promise.all([
      User.findById(payload.sub),
      Session.findById(payload.sid)
    ]);

    if (!user || !user.isActive) {
      throw Errors.tokenInvalid();
    }
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw Errors.tokenInvalid();
    }

    return {
      currentUser: user,
      currentSessionId: String(session._id)
    };
  });
