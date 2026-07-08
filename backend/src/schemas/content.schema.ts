import { t } from 'elysia';

export const contentQuerySchema = t.Object({
  q: t.Optional(t.String({ maxLength: 100 })),
  genre: t.Optional(t.String({ maxLength: 40 })),
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 20 }))
});

export const createContentSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  slug: t.String({ minLength: 1, maxLength: 200, pattern: '^[a-z0-9-]+$' }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  type: t.Union([t.Literal('MOVIE'), t.Literal('SERIES')]),
  genres: t.Optional(t.Array(t.String({ maxLength: 40 }), { maxItems: 10 })),
  maturityRating: t.Optional(t.Number({ minimum: 0, maximum: 18 })),
  releaseYear: t.Number({ minimum: 1888, maximum: 2100 }),
  posterUrl: t.Optional(t.String({ maxLength: 500 })),
  videoAssetKey: t.String({ minLength: 1, maxLength: 300 }),
  requiredPlan: t.Union([t.Literal('FREE'), t.Literal('BASIC'), t.Literal('STANDARD'), t.Literal('PREMIUM')]),
  availableRegions: t.Optional(t.Array(t.String({ minLength: 2, maxLength: 2 }))),
  isPublished: t.Optional(t.Boolean())
});

export const watchProgressSchema = t.Object({
  profileId: t.String({ minLength: 24, maxLength: 24 }),
  contentId: t.String({ minLength: 24, maxLength: 24 }),
  positionSeconds: t.Number({ minimum: 0 }),
  durationSeconds: t.Number({ minimum: 0 })
});
