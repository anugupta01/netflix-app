import { Elysia, t } from 'elysia';
import { Content } from '../models/Content';
import { User } from '../models/User';
import { authGuard } from '../middleware/authGuard';
import { requireRole } from '../middleware/rbac';
import { Errors } from '../lib/errors';
import { createContentSchema } from '../schemas/content.schema';

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .use(requireRole('ADMIN')) // every route below this line requires ADMIN role

  // --- Content management -----------------------------------------------------
  .post(
    '/content',
    async ({ body }) => {
      const existing = await Content.findOne({ slug: body.slug });
      if (existing) throw Errors.validation('A title with this slug already exists.');
      const content = await Content.create(body);
      return { content };
    },
    { body: createContentSchema }
  )

  .patch(
    '/content/:id',
    async ({ params, body }) => {
      const content = await Content.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
      if (!content) throw Errors.notFound('Title');
      return { content };
    },
    { body: t.Partial(createContentSchema) }
  )

  .delete('/content/:id', async ({ params }) => {
    const content = await Content.findByIdAndDelete(params.id);
    if (!content) throw Errors.notFound('Title');
    return { success: true };
  })

  // --- User management ---------------------------------------------------------
  .get('/users', async ({ query }) => {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const [users, total] = await Promise.all([
      User.find().select('email role isActive planTier createdAt').skip((page - 1) * limit).limit(limit),
      User.countDocuments()
    ]);
    return { users, page, limit, total };
  })

  .patch(
    '/users/:id/deactivate',
    async ({ params, currentUser }) => {
      if (String(params.id) === String(currentUser._id)) {
        throw Errors.forbidden('You cannot deactivate your own account.');
      }
      const user = await User.findByIdAndUpdate(params.id, { isActive: false }, { new: true });
      if (!user) throw Errors.notFound('User');
      return { success: true };
    }
  )

  .patch('/users/:id/reactivate', async ({ params }) => {
    const user = await User.findByIdAndUpdate(params.id, { isActive: true }, { new: true });
    if (!user) throw Errors.notFound('User');
    return { success: true };
  });
