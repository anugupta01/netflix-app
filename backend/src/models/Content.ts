import { Schema, model, Types } from 'mongoose';

export type ContentType = 'MOVIE' | 'SERIES';

export interface IContent {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  type: ContentType;
  genres: string[];
  maturityRating: number; // 0-18, compared against profile.maturityLimit
  releaseYear: number;
  posterUrl: string;
  videoAssetKey: string; // opaque key resolved to a signed URL at watch-time, never exposed directly
  requiredPlan: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  availableRegions: string[]; // ISO country codes; empty array = all regions
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 2000 },
    type: { type: String, enum: ['MOVIE', 'SERIES'], required: true },
    genres: { type: [String], default: [] },
    maturityRating: { type: Number, default: 0, min: 0, max: 18 },
    releaseYear: { type: Number, required: true },
    posterUrl: { type: String, default: '' },
    videoAssetKey: { type: String, required: true, select: false },
    requiredPlan: { type: String, enum: ['FREE', 'BASIC', 'STANDARD', 'PREMIUM'], default: 'FREE' },
    availableRegions: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false }
  },
  { timestamps: true }
);

contentSchema.index({ title: 'text', description: 'text' });
contentSchema.index({ genres: 1, isPublished: 1 });

export const Content = model<IContent>('Content', contentSchema);
