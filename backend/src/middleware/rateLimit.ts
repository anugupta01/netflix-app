import { Elysia } from 'elysia';
import { Errors } from '../lib/errors';

// Simple in-memory fixed-window limiter, keyed by IP + route bucket.
// Good enough for a single-instance deployment; swap the Map for Redis
// (INCR + EXPIRE) before running more than one backend instance, since
// in-memory state won't be shared across processes.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; bucketName: string }) {
  return new Elysia().derive({ as: 'scoped' }, ({ request, headers }) => {
    const ip =
      headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      // @ts-ignore - Bun/Elysia expose the raw socket address here in practice
      request.headers.get('x-real-ip') ||
      'unknown';

    const key = `${options.bucketName}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return {};
    }

    existing.count += 1;
    if (existing.count > options.max) {
      throw Errors.rateLimited();
    }
    return {};
  });
}

// Periodic cleanup so the Map doesn't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();
