import { Schema, model, Types } from 'mongoose';

// Netflix-style: one account, multiple viewing profiles (kids mode, maturity gating, etc).
export interface IProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  avatarUrl: string;
  isKids: boolean;
  maturityLimit: number; // e.g. maps to content.maturityRating
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    avatarUrl: { type: String, default: '' },
    isKids: { type: Boolean, default: false },
    maturityLimit: { type: Number, default: 18, min: 0, max: 18 }
  },
  { timestamps: true }
);

export const Profile = model<IProfile>('Profile', profileSchema);
