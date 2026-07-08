import { Elysia, t } from 'elysia';
import { Content } from '../models/Content';
import { Profile } from '../models/Profile';
import { WatchHistory } from '../models/WatchHistory';
import { authGuard } from '../middleware/authGuard';
import { hasSufficientPlan, isPlanCurrentlyActive } from '../middleware/rbac';
import { Errors } from '../lib/errors';
import { issueStreamToken, verifyStreamToken } from '../lib/streamToken';
import { watchProgressSchema } from '../schemas/content.schema';

async function assertPlaybackAllowed(currentUser: any, content: any, profile: any) {
  if (!content || !content.isPublished) throw Errors.notFound('Title');
  if (!isPlanCurrentlyActive(currentUser)) throw Errors.planRequired(content.requiredPlan);
  if (!hasSufficientPlan(currentUser.planTier, content.requiredPlan)) throw Errors.planRequired(content.requiredPlan);
  if (content.maturityRating > profile.maturityLimit) {
    throw Errors.forbidden('This title exceeds the selected profile\u2019s maturity setting.');
  }
}

export const watchRoutes = new Elysia({ prefix: '/watch' })
  .use(authGuard)

  // --- Request a signed playback URL -----------------------------------------
  .post(
    '/:contentId/stream-url',
    async ({ params, body, currentUser }) => {
      const profile = await Profile.findOne({ _id: body.profileId, userId: currentUser._id });
      if (!profile) throw Errors.notFound('Profile');
      const content = await Content.findById(params.contentId).select('+videoAssetKey');
      await assertPlaybackAllowed(currentUser, content, profile);

      const token = issueStreamToken({ contentId: String(content!._id), profileId: String(profile._id) });

      return {
        streamUrl: `/cdn/stream?token=${token}`,
        expiresInSeconds: 300
      };
    },
    { body: t.Object({ profileId: t.String({ minLength: 24, maxLength: 24 }) }) }
  )

  // --- Verify a stream token (this is what an edge/CDN layer would call) -----
  .get('/verify-stream-token', async ({ query }) => {
    const payload = verifyStreamToken(String(query.token ?? ''));
    if (!payload) throw Errors.tokenInvalid();
    return { valid: true, contentId: payload.contentId, profileId: payload.profileId };
  })

  // --- Continue watching: upsert progress ------------------------------------
  .put(
    '/progress',
    async ({ body, currentUser }) => {
      const profile = await Profile.findOne({ _id: body.profileId, userId: currentUser._id });
      if (!profile) throw Errors.notFound('Profile');

      // Reject nonsensical values a tampered client could send (position
      // beyond duration, negative numbers already blocked by schema).
      if (body.positionSeconds > body.durationSeconds + 5) {
        throw Errors.validation('positionSeconds cannot exceed durationSeconds.');
      }

      const isFinished = body.durationSeconds > 0 && body.positionSeconds / body.durationSeconds >= 0.95;

      const entry = await WatchHistory.findOneAndUpdate(
        { profileId: profile._id, contentId: body.contentId },
        {
          positionSeconds: body.positionSeconds,
          durationSeconds: body.durationSeconds,
          isFinished
        },
        { upsert: true, new: true }
      );

      return { entry };
    },
    { body: watchProgressSchema }
  )

  // --- Continue watching: list ------------------------------------------------
  .get('/continue/:profileId', async ({ params, currentUser }) => {
    const profile = await Profile.findOne({ _id: params.profileId, userId: currentUser._id });
    if (!profile) throw Errors.notFound('Profile');

    const items = await WatchHistory.find({ profileId: profile._id, isFinished: false })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate({ path: 'contentId', select: '-videoAssetKey' });

    return { items };
  });
