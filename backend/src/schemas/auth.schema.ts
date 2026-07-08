import { t } from 'elysia';

// Input validation happens here, at the boundary, before any handler logic
// runs — Elysia rejects non-conforming bodies with a 422 automatically.
// This is the first line of defense against malformed JSON, oversized
// payloads, wrong types, and basic injection attempts.
export const signupSchema = t.Object({
  email: t.String({ format: 'email', maxLength: 254 }),
  password: t.String({ minLength: 10, maxLength: 128 }),
  name: t.String({ minLength: 1, maxLength: 60 })
});

export const loginSchema = t.Object({
  email: t.String({ format: 'email', maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 128 })
});

export const refreshSchema = t.Object({
  refreshToken: t.String({ minLength: 20, maxLength: 200 })
});
