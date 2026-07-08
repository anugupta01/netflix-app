import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';
import { User } from '../models/User';
import { Session } from '../models/Session';
import {
  hashPassword,
  verifyPassword,
  isPasswordStrongEnough,
  createSession,
  rotateSession,
  revokeAllSessionsForUser,
  hashToken
} from '../lib/auth';
import { Errors } from '../lib/errors';
import { env } from '../config/env';
import { signupSchema, loginSchema } from '../schemas/auth.schema';
import { jwtAccess, authGuard } from '../middleware/authGuard';
import { rateLimit } from '../middleware/rateLimit';

const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/auth', // scoped narrowly — this cookie is only ever sent to /auth/* routes
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false, // deliberately readable by frontend JS so it can echo it back in a header
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/auth',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60
  };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtAccess)

  // --- Signup -------------------------------------------------------------
  .post(
    '/signup',
    async ({ body, jwtAccess, cookie, request }) => {
      const email = body.email.toLowerCase().trim();

      if (!isPasswordStrongEnough(body.password)) {
        throw Errors.validation(
          'Password must be at least 10 characters and include at least 3 of: lowercase, uppercase, digit, symbol.'
        );
      }

      // Pre-check gives a fast, friendly error in the common case; the unique
      // Mongo index (see User model) is what actually prevents a race between
      // two concurrent signups with the same email from both succeeding.
      const existing = await User.findOne({ email });
      if (existing) throw Errors.emailInUse();

      const passwordHash = await hashPassword(body.password);

      let user;
      try {
        user = await User.create({ email, passwordHash });
      } catch (err: any) {
        if (err?.code === 11000) throw Errors.emailInUse(); // race-condition duplicate caught here
        throw err;
      }

      const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
      const userAgent = request.headers.get('user-agent') ?? 'unknown';
      const { session, refreshToken } = await createSession({ userId: String(user._id), userAgent, ip });

      const accessToken = await jwtAccess.sign({ sub: String(user._id), role: user.role, sid: String(session._id) });
      const csrfToken = nanoid(32);

      cookie[REFRESH_COOKIE].set({ value: refreshToken, ...refreshCookieOptions() });
      cookie[CSRF_COOKIE].set({ value: csrfToken, ...csrfCookieOptions() });

      return {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role, planTier: user.planTier }
      };
    },
    { body: signupSchema }
  )

  // --- Login ---------------------------------------------------------------
  .use(rateLimit({ windowMs: env.rateLimitWindowMs, max: env.rateLimitMaxAuth, bucketName: 'login' }))
  .post(
    '/login',
    async ({ body, jwtAccess, cookie, request }) => {
      const email = body.email.toLowerCase().trim();
      // select('+passwordHash') because the schema hides it by default
      const user = await User.findOne({ email }).select('+passwordHash');

      // Same generic error whether the email doesn't exist or the password is
      // wrong — never reveal which one, or you hand attackers a free
      // email-enumeration oracle.
      if (!user) throw Errors.invalidCredentials();

      if (!user.isActive) throw Errors.accountDeactivated();

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        throw Errors.accountLocked(minutesLeft);
      }

      const validPassword = await verifyPassword(body.password, user.passwordHash);
      if (!validPassword) {
        user.failedLoginAttempts += 1;
        if (user.failedLoginAttempts >= env.maxFailedLoginAttempts) {
          user.lockedUntil = new Date(Date.now() + env.loginLockoutMinutes * 60 * 1000);
          user.failedLoginAttempts = 0; // reset counter now that the lockout itself is the penalty
        }
        await user.save();
        throw Errors.invalidCredentials();
      }

      // Successful login clears any prior failed-attempt count.
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await user.save();
      }

      // Concurrent-device cap: count sessions that are still valid.
      const activeDeviceCount = await Session.countDocuments({
        userId: user._id,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });
      if (activeDeviceCount >= env.maxDevicesPerAccount) {
        throw Errors.tooManyDevices(env.maxDevicesPerAccount);
      }

      const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
      const userAgent = request.headers.get('user-agent') ?? 'unknown';
      const { session, refreshToken } = await createSession({ userId: String(user._id), userAgent, ip });

      const accessToken = await jwtAccess.sign({ sub: String(user._id), role: user.role, sid: String(session._id) });
      const csrfToken = nanoid(32);

      cookie[REFRESH_COOKIE].set({ value: refreshToken, ...refreshCookieOptions() });
      cookie[CSRF_COOKIE].set({ value: csrfToken, ...csrfCookieOptions() });

      return {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role, planTier: user.planTier }
      };
    },
    { body: loginSchema }
  )

  // --- Refresh ---------------------------------------------------------------
  // Double-submit CSRF check: the browser auto-sends the httpOnly cookie, but
  // a cross-site attacker can't also set the matching X-CSRF-Token header,
  // since that requires reading the (non-httpOnly, same-origin-only) csrf cookie.
  .post('/refresh', async ({ cookie, headers, jwtAccess, request }) => {
    const refreshToken = cookie[REFRESH_COOKIE].value;
    if (!refreshToken) throw Errors.tokenInvalid();

    const csrfCookieValue = cookie[CSRF_COOKIE].value;
    const csrfHeaderValue = headers['x-csrf-token'];
    if (!csrfCookieValue || csrfCookieValue !== csrfHeaderValue) {
      throw Errors.forbidden('CSRF token missing or mismatched.');
    }

    const tokenHash = hashToken(refreshToken);
    const session = await Session.findOne({ refreshTokenHash: tokenHash });

    if (!session) throw Errors.tokenInvalid();

    // Reuse detection: this exact refresh token was already rotated away once
    // before (isRevoked + replacedBy set) and is now being presented again.
    // That only happens if it was stolen and both the attacker and the
    // legitimate user tried to use it — treat the whole session family as compromised.
    if (session.isRevoked) {
      await revokeAllSessionsForUser(String(session.userId));
      throw Errors.tokenInvalid();
    }

    if (session.expiresAt < new Date()) {
      throw Errors.tokenExpired();
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) throw Errors.tokenInvalid();

    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const userAgent = request.headers.get('user-agent') ?? 'unknown';
    const { session: newSession, refreshToken: newRefreshToken } = await rotateSession(session, { ip, userAgent });

    session.lastUsedAt = new Date();
    await session.save();

    const accessToken = await jwtAccess.sign({ sub: String(user._id), role: user.role, sid: String(newSession._id) });
    const newCsrfToken = nanoid(32);

    cookie[REFRESH_COOKIE].set({ value: newRefreshToken, ...refreshCookieOptions() });
    cookie[CSRF_COOKIE].set({ value: newCsrfToken, ...csrfCookieOptions() });

    return { accessToken };
  })

  // --- Logout (this device only) ---------------------------------------------
  .post('/logout', async ({ cookie, headers }) => {
    const refreshToken = cookie[REFRESH_COOKIE].value;
    const csrfCookieValue = cookie[CSRF_COOKIE].value;
    const csrfHeaderValue = headers['x-csrf-token'];

    if (refreshToken && csrfCookieValue && csrfCookieValue === csrfHeaderValue) {
      const tokenHash = hashToken(refreshToken);
      await Session.findOneAndUpdate({ refreshTokenHash: tokenHash }, { isRevoked: true });
    }
    // Clear cookies regardless — logging out should always succeed client-side
    // even if the session was already gone server-side.
    cookie[REFRESH_COOKIE].remove();
    cookie[CSRF_COOKIE].remove();
    return { success: true };
  })

  // --- Authenticated session-management endpoints ---------------------------
  .use(authGuard)
  .post('/logout-all', async ({ currentUser, cookie }) => {
    await revokeAllSessionsForUser(String(currentUser._id));
    cookie[REFRESH_COOKIE].remove();
    cookie[CSRF_COOKIE].remove();
    return { success: true };
  })
  .get('/sessions', async ({ currentUser, currentSessionId }) => {
    const sessions = await Session.find({
      userId: currentUser._id,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    }).select('userAgent ip createdAt lastUsedAt');

    return {
      sessions: sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        isCurrent: String(s._id) === currentSessionId
      }))
    };
  })
  .delete('/sessions/:id', async ({ currentUser, params }) => {
    // Ownership check matters here: without it, any authenticated user could
    // pass an arbitrary session id and revoke someone else's device (an IDOR).
    const session = await Session.findOne({ _id: params.id, userId: currentUser._id });
    if (!session) throw Errors.notFound('Session');
    session.isRevoked = true;
    await session.save();
    return { success: true };
  });
