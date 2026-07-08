import { Elysia } from 'elysia';
import { Content } from '../models/Content';
import { Profile } from '../models/Profile';
import { authGuard } from '../middleware/authGuard';
import { hasSufficientPlan, isPlanCurrentlyActive } from '../middleware/rbac';
import { rateLimit } from '../middleware/rateLimit';
import { Errors } from '../lib/errors';
import { contentQuerySchema } from '../schemas/content.schema';
import { env } from '../config/env';

export const contentRoutes = new Elysia({ prefix: '/content' })
  .use(authGuard)
  .use(rateLimit({ windowMs: env.rateLimitWindowMs, max: env.rateLimitMaxGeneral, bucketName: 'content-browse' }))

  // --- Browse / search -------------------------------------------------------
  .get(
    '/',
    async ({ query }) => {
      // Clamp pagination regardless of what was requested — prevents a
      // ?limit=999999 style query from forcing the DB to materialize an
      // enormous result set (a cheap denial-of-service vector).
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(50, Math.max(1, query.limit ?? 20));

      const filter: Record<string, unknown> = { isPublished: true };

      // Use Mongo's built-in $text search rather than building a user-supplied
      // regex — an attacker-controlled regex (e.g. nested quantifiers) can
      // cause catastrophic backtracking and hang the process (ReDoS).
      if (query.q) {
        filter.$text = { $search: query.q };
      }
      if (query.genre) {
        filter.genres = query.genre;
      }

      const [items, total] = await Promise.all([
        Content.find(filter)
          .select('-videoAssetKey')
          .sort(query.q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Content.countDocuments(filter)
      ]);

      return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    },
    { query: contentQuerySchema }
  )

  // --- Single title detail (metadata only — no stream URL here) --------------
  .get('/:id', async ({ params }) => {
    const content = await Content.findOne({ _id: params.id, isPublished: true }).select('-videoAssetKey');
    if (!content) throw Errors.notFound('Title');
    return { content };
  })

  // --- Authorization check used before allowing playback ---------------------
  // Real streaming URL issuance lives in watch.routes.ts; this route exists
  // so the frontend can pre-flight "can this profile play this title" and
  // show an upgrade/region prompt instead of a broken player.
  .get('/:id/access-check', async ({ params, currentUser, query }) => {
    const content = await Content.findOne({ _id: params.id, isPublished: true });
    if (!content) throw Errors.notFound('Title');

    if (!isPlanCurrentlyActive(currentUser)) {
      throw Errors.planRequired(content.requiredPlan);
    }
    if (!hasSufficientPlan(currentUser.planTier, content.requiredPlan)) {
      throw Errors.planRequired(content.requiredPlan);
    }

    if (content.availableRegions.length > 0) {
      const region = String(query.region ?? '').toUpperCase();
      if (!region || !content.availableRegions.includes(region)) {
        throw Errors.regionBlocked();
      }
    }

    if (query.profileId) {
      const profile = await Profile.findOne({ _id: query.profileId, userId: currentUser._id });
      if (!profile) throw Errors.notFound('Profile');
      if (content.maturityRating > profile.maturityLimit) {
        throw Errors.forbidden('This title exceeds the selected profile\u2019s maturity setting.');
      }
    }

    return { allowed: true };
  });
