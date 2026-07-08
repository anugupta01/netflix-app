import { Elysia } from 'elysia';
import { Errors } from '../lib/errors';
import type { Role } from '../models/User';

// Composes with authGuard. Usage: .use(authGuard).use(requireRole('ADMIN'))
// Kept as a factory (not a single hardcoded check) so new roles/routes don't
// require touching this file's internals — they just call it differently.
export const requireRole = (...allowed: Role[]) =>
  new Elysia().derive({ as: 'scoped' }, ({ currentUser }: any) => {
    if (!currentUser) {
      // Defensive: this middleware must always run after authGuard.
      throw Errors.unauthorized();
    }
    if (!allowed.includes(currentUser.role)) {
      throw Errors.forbidden(`This action requires one of these roles: ${allowed.join(', ')}.`);
    }
    return {};
  });

const PLAN_RANK: Record<string, number> = { FREE: 0, BASIC: 1, STANDARD: 2, PREMIUM: 3 };

export function hasSufficientPlan(userPlan: string, requiredPlan: string): boolean {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
}

// Subscription expiry is checked against the LIVE date on every gated request,
// not cached on the access token — so access is revoked the moment a plan
// lapses, not up to 15 minutes later when the token happens to expire.
export function isPlanCurrentlyActive(user: { planTier: string; planExpiresAt: Date | null }): boolean {
  if (user.planTier === 'FREE') return true;
  if (!user.planExpiresAt) return false;
  return user.planExpiresAt.getTime() > Date.now();
}
