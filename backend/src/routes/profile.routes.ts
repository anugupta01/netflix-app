import { Elysia, t } from 'elysia';
import { Profile } from '../models/Profile';
import { WatchHistory } from '../models/WatchHistory';
import { authGuard } from '../middleware/authGuard';
import { Errors } from '../lib/errors';

const MAX_PROFILES_PER_ACCOUNT = 5;

const profileBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 40 }),
  avatarUrl: t.Optional(t.String({ maxLength: 500 })),
  isKids: t.Optional(t.Boolean()),
  maturityLimit: t.Optional(t.Number({ minimum: 0, maximum: 18 }))
});

export const profileRoutes = new Elysia({ prefix: '/profiles' })
  .use(authGuard)

  .get('/', async ({ currentUser }) => {
    const profiles = await Profile.find({ userId: currentUser._id });
    return { profiles };
  })

  .post(
    '/',
    async ({ currentUser, body }) => {
      const count = await Profile.countDocuments({ userId: currentUser._id });
      if (count >= MAX_PROFILES_PER_ACCOUNT) {
        throw Errors.forbidden(`Maximum of ${MAX_PROFILES_PER_ACCOUNT} profiles per account.`);
      }
      // Kids profiles cannot be granted an adult maturity limit, regardless
      // of what the client sends — server is the source of truth here.
      const isKids = !!body.isKids;
      const maturityLimit = isKids ? Math.min(body.maturityLimit ?? 12, 12) : body.maturityLimit ?? 18;

      const profile = await Profile.create({
        userId: currentUser._id,
        name: body.name,
        avatarUrl: body.avatarUrl ?? '',
        isKids,
        maturityLimit
      });
      return { profile };
    },
    { body: profileBodySchema }
  )

  .patch(
    '/:id',
    async ({ currentUser, params, body }) => {
      // Ownership check: a profile can only be modified by the account that owns it.
      const profile = await Profile.findOne({ _id: params.id, userId: currentUser._id });
      if (!profile) throw Errors.notFound('Profile');

      if (body.name !== undefined) profile.name = body.name;
      if (body.avatarUrl !== undefined) profile.avatarUrl = body.avatarUrl;
      if (body.isKids !== undefined) profile.isKids = body.isKids;
      if (body.maturityLimit !== undefined) {
        profile.maturityLimit = profile.isKids ? Math.min(body.maturityLimit, 12) : body.maturityLimit;
      }
      await profile.save();
      return { profile };
    },
    { body: t.Partial(profileBodySchema) }
  )

  .delete('/:id', async ({ currentUser, params }) => {
    const profile = await Profile.findOneAndDelete({ _id: params.id, userId: currentUser._id });
    if (!profile) throw Errors.notFound('Profile');
    // Clean up dependent watch history so it doesn't orphan silently in the DB.
    await WatchHistory.deleteMany({ profileId: profile._id });
    return { success: true };
  });
