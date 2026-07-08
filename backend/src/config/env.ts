// Central place that reads and validates process.env once at boot.
// Fail fast: if a required secret is missing, the server should not start
// silently with an insecure default in production.

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', isProd ? undefined : 'mongodb://127.0.0.1:27017/netflix_clone'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET', isProd ? undefined : 'dev_access_secret_do_not_use_in_prod'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', isProd ? undefined : 'dev_refresh_secret_do_not_use_in_prod'),
  streamUrlSecret: required('STREAM_URL_SECRET', isProd ? undefined : 'dev_stream_secret_do_not_use_in_prod'),
  streamUrlTtlSeconds: Number(process.env.STREAM_URL_TTL_SECONDS ?? 300),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  maxDevicesPerAccount: Number(process.env.MAX_DEVICES_PER_ACCOUNT ?? 4),
  maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS ?? 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxAuth: Number(process.env.RATE_LIMIT_MAX_AUTH ?? 10),
  rateLimitMaxGeneral: Number(process.env.RATE_LIMIT_MAX_GENERAL ?? 100)
};

if (env.isProd) {
  const insecureDefaults = ['dev_access_secret_do_not_use_in_prod', 'dev_refresh_secret_do_not_use_in_prod'];
  if (insecureDefaults.includes(env.jwtAccessSecret) || insecureDefaults.includes(env.jwtRefreshSecret)) {
    throw new Error('Refusing to start in production with default JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
  }
}
