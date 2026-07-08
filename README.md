# Netflix-style Streaming Platform \u2014 ElysiaJS + MongoDB + React

A full-stack scaffold covering authentication, authorization, and the
edge cases a real streaming service actually has to handle \u2014 not just the
happy path.

## Stack

- **Backend:** Bun + ElysiaJS + Mongoose (MongoDB)
- **Frontend:** React 19.2.7 + Vite + react-router-dom v6

## Running it

### Backend
```bash
cd backend
bun install
cp .env.example .env        # then fill in real secrets before deploying anywhere
bun run seed                # creates an admin user + sample titles
bun run dev                 # http://localhost:4000, docs at /docs
```
Seeded admin login: `admin@netflixclone.dev` / `ChangeMe!2026` \u2014 change this immediately in any shared environment.

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Security & authentication design

- **Password storage:** Argon2id via `Bun.password` (memory-hard, not a fast general-purpose hash) \u2014 see `backend/src/lib/auth.ts`.
- **Access tokens:** short-lived JWTs (15 min default), verified AND cross-checked against a live Session/User record on every request \u2014 so revocation and deactivation take effect immediately, not just when the JWT happens to expire.
- **Refresh tokens:** opaque random strings, not JWTs. Only a SHA-256 hash is stored server-side, delivered via an `httpOnly`, `SameSite=Lax`, path-scoped cookie. A DB leak alone can never be replayed as a valid refresh token.

## Edge cases explicitly handled

| Scenario | Where |
|---|---|
| Duplicate signup (incl. race condition between two concurrent requests) | `auth.routes.ts` \u2014 pre-check + unique Mongo index + E11000 catch |
| Wrong password vs. nonexistent email | Same generic error either way \u2014 no email enumeration |
| Repeated failed logins | Progressive lockout (`lockedUntil`) |
| Stolen/replayed refresh token | Rotation + reuse detection revokes the whole session family |
| Too many concurrent devices | `MAX_DEVICES_PER_ACCOUNT` enforced at login |
| Subscription lapses mid-session | Checked live on every gated request, not cached |
| Content above a profile's maturity limit | Checked at both `/access-check` and actual stream-URL issuance |
| Region-restricted titles | `availableRegions` checked against a region param |
| Tampered playback progress (position > duration) | Rejected server-side regardless of client claims |
| Admin routes hit by a regular user | RBAC `requireRole('ADMIN')` \u2192 403 |
| One profile/session modifying another account's data (IDOR) | Every profile/session query is scoped to `userId` ownership |
| Pagination abuse (`?limit=999999`) | Clamped server-side regardless of requested value |
| Malformed JSON / wrong field types | Global validation \u2192 422, never a 500 |
| Access token expires mid-session (frontend) | Silent refresh-and-retry in the axios interceptor, transparent to the user |
| Hard page reload | Silent refresh-on-load using the httpOnly cookie re-establishes the in-memory access token |

## Deliberately stubbed (flagged, not hidden)

- **Payment processing** (`subscription.routes.ts`): no real Stripe/payment-provider call is wired in. The comment in that file spells out exactly what a real integration needs (webhook-verified charge, idempotency key) before trusting a plan upgrade.
- **Video delivery**: `stream-url` issues a signed, short-lived token (`lib/streamToken.ts`) meant to be verified by a CDN/edge function \u2014 no actual video files are served by this backend.
- **Email verification**: the `isEmailVerified` field exists on the User model but no email-sending flow is wired up.

## What to change before any real deployment

1. Replace every secret in `.env` with long random values (`openssl rand -hex 64`) \u2014 the server already refuses to boot in production with the placeholder defaults.
2. Swap the in-memory rate limiter (`middleware/rateLimit.ts`) for Redis if running more than one backend instance.
3. Wire up a real payment provider and CDN before trusting `subscription.routes.ts` or `watch.routes.ts` with real content/money.
