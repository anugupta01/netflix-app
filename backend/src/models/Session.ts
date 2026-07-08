import { Schema, model, Types } from 'mongoose';

// One document per issued refresh token (i.e. per logged-in device).
// This is what makes "logout this device", "logout everywhere", concurrent-device
// limits, and refresh-token-reuse detection possible — a stateless JWT alone can't do any of these.
export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string; // never store the raw token
  userAgent: string;
  ip: string;
  isRevoked: boolean;
  replacedBy: Types.ObjectId | null; // set when rotated, used for reuse detection
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    isRevoked: { type: Boolean, default: false },
    replacedBy: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

// TTL index: Mongo automatically purges expired sessions, so revoked/expired
// devices don't pile up forever.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>('Session', sessionSchema);
