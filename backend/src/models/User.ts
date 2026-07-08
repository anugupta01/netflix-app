import { Schema, model, Types } from 'mongoose';

// Roles kept intentionally small and explicit — RBAC middleware checks against this enum,
// so adding a role means updating it here and reviewing every route that gates on role.
export type Role = 'USER' | 'ADMIN';
export type PlanTier = 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: Role;
  isEmailVerified: boolean;
  isActive: boolean; // soft-deactivation, distinct from hard delete
  planTier: PlanTier;
  planExpiresAt: Date | null;

  // Brute-force protection state
  failedLoginAttempts: number;
  lockedUntil: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Basic shape check only — real deliverability is verified via email confirmation flow,
      // not by regex, since regex can never fully validate an email address.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    planTier: { type: String, enum: ['FREE', 'BASIC', 'STANDARD', 'PREMIUM'], default: 'FREE' },
    planExpiresAt: { type: Date, default: null },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

// Defense in depth: unique index at the DB layer, not just app-layer validation,
// so a race condition between two concurrent signups can't create duplicate accounts.
userSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser>('User', userSchema);
