import { Elysia, t } from 'elysia';
import { authGuard } from '../middleware/authGuard';
import { Errors } from '../lib/errors';

const PLANS = {
  FREE: { price: 0, months: 0 },
  BASIC: { price: 6.99, months: 1 },
  STANDARD: { price: 11.99, months: 1 },
  PREMIUM: { price: 15.99, months: 1 }
} as const;

const subscribeSchema = t.Object({
  plan: t.Union([t.Literal('BASIC'), t.Literal('STANDARD'), t.Literal('PREMIUM')]),
  // In a real system this would be a payment-provider token (Stripe, etc.),
  // never raw card details — this backend should never see a PAN or CVV.
  paymentMethodToken: t.String({ minLength: 1, maxLength: 200 })
});

export const subscriptionRoutes = new Elysia({ prefix: '/subscription' })
  .use(authGuard)

  .get('/plans', () => ({ plans: PLANS }))

  .get('/me', ({ currentUser }) => ({
    planTier: currentUser.planTier,
    planExpiresAt: currentUser.planExpiresAt
  }))

  .post(
    '/subscribe',
    async ({ currentUser, body }) => {
      // NOTE: this is a stub. A real integration would call out to the
      // payment provider here (e.g. Stripe PaymentIntent confirm), verify the
      // charge succeeded via webhook/idempotency key, and only THEN update
      // the plan below — never flip planTier on the strength of a client-supplied
      // "it worked" claim alone, since that's trivially fakeable.
      if (!body.paymentMethodToken) {
        throw Errors.validation('A valid payment method is required.');
      }

      const plan = PLANS[body.plan];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + plan.months);

      currentUser.planTier = body.plan;
      currentUser.planExpiresAt = expiresAt;
      await currentUser.save();

      return { planTier: currentUser.planTier, planExpiresAt: currentUser.planExpiresAt };
    },
    { body: subscribeSchema }
  )

  .post('/cancel', async ({ currentUser }) => {
    // Cancellation takes effect at period end, not immediately — access
    // shouldn't vanish mid-billing-cycle the user already paid for.
    // planExpiresAt is left as-is; a scheduled job would downgrade to FREE
    // once planExpiresAt passes with no renewal on file.
    return {
      planTier: currentUser.planTier,
      accessUntil: currentUser.planExpiresAt,
      message: 'Subscription will not renew. Access remains until the current billing period ends.'
    };
  });
