import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { env } from './config/env';
import { connectDB } from './config/db';
import { AppError } from './lib/errors';

import { authRoutes } from './routes/auth.routes';
import { profileRoutes } from './routes/profile.routes';
import { contentRoutes } from './routes/content.routes';
import { watchRoutes } from './routes/watch.routes';
import { subscriptionRoutes } from './routes/subscription.routes';
import { adminRoutes } from './routes/admin.routes';

await connectDB();

const app = new Elysia()

  // --- Security headers --------------------------------------------------
  // Equivalent of helmet(): applied globally via onAfterHandle so it covers
  // every response, including error responses.
  .onAfterHandle(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()';
    if (env.isProd) {
      set.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
    }
  })

  .use(
    cors({
      origin: env.corsOrigin,
      credentials: true, // required so the refresh-token cookie is sent/received
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    })
  )

  .use(
    swagger({
      path: '/docs',
      documentation: { info: { title: 'Netflix Clone API', version: '1.0.0' } }
    })
  )

  // --- Global error handler -------------------------------------------------
  // Single place that turns any thrown error into a consistent JSON shape.
  // Unrecognized errors are logged in full server-side but returned to the
  // client as a generic 500 — never leak stack traces, Mongo error text, or
  // internal file paths to the caller.
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return { error: { code: error.code, message: error.message } };
    }

    if (code === 'VALIDATION') {
      set.status = 422;
      return { error: { code: 'VALIDATION_ERROR', message: 'Request did not match the expected format.' } };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: { code: 'NOT_FOUND', message: 'Resource not found.' } };
    }

    console.error('[unhandled error]', error);
    set.status = 500;
    return { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } };
  })

  .get('/health', () => ({ status: 'ok', time: new Date().toISOString() }))

  .use(authRoutes)
  .use(profileRoutes)
  .use(contentRoutes)
  .use(watchRoutes)
  .use(subscriptionRoutes)
  .use(adminRoutes)

  .listen(env.port);

console.log(`[server] listening on http://localhost:${env.port}`);
console.log(`[server] API docs at http://localhost:${env.port}/docs`);
