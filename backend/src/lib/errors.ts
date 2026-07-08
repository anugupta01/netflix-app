// Small, explicit error taxonomy. Routes throw these; the global error handler
// in index.ts maps them to consistent { error: { code, message } } JSON —
// never a raw stack trace, never a raw Mongoose/driver error to the client.
export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'),
  accountLocked: (minutes: number) =>
    new AppError(423, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${minutes} minute(s).`),
  accountDeactivated: () => new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.'),
  emailInUse: () => new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.'),
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'Authentication required.'),
  tokenExpired: () => new AppError(401, 'TOKEN_EXPIRED', 'Session expired, please refresh.'),
  tokenInvalid: () => new AppError(401, 'TOKEN_INVALID', 'Invalid or revoked session.'),
  forbidden: (reason = 'You do not have permission to perform this action.') =>
    new AppError(403, 'FORBIDDEN', reason),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  planRequired: (plan: string) =>
    new AppError(402, 'PLAN_REQUIRED', `This title requires the ${plan} plan or higher.`),
  regionBlocked: () => new AppError(451, 'REGION_BLOCKED', 'This title is not available in your region.'),
  tooManyDevices: (max: number) =>
    new AppError(409, 'DEVICE_LIMIT_REACHED', `Maximum of ${max} active devices reached.`),
  rateLimited: () => new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'),
  validation: (message: string) => new AppError(400, 'VALIDATION_ERROR', message)
};
