import { Schema, model, Types } from 'mongoose';

export interface IWatchHistory {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  contentId: Types.ObjectId;
  positionSeconds: number;
  durationSeconds: number;
  isFinished: boolean;
  updatedAt: Date;
}

const watchHistorySchema = new Schema<IWatchHistory>(
  {
    profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    positionSeconds: { type: Number, default: 0, min: 0 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    isFinished: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// One row per (profile, content) — "continue watching" upserts into this, it doesn't append.
watchHistorySchema.index({ profileId: 1, contentId: 1 }, { unique: true });

export const WatchHistory = model<IWatchHistory>('WatchHistory', watchHistorySchema);
