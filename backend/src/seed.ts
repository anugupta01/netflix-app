// Run with: bun run src/seed.ts
// Creates one admin account and a handful of sample titles so the frontend
// has something to browse against a fresh database.
import { connectDB } from './config/db';
import { User } from './models/User';
import { Content } from './models/Content';
import { hashPassword } from './lib/auth';

async function seed() {
  await connectDB();

  const adminEmail = 'admin@netflixclone.dev';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      email: adminEmail,
      passwordHash: await hashPassword('ChangeMe!2026'),
      role: 'ADMIN',
      isEmailVerified: true,
      planTier: 'PREMIUM',
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    console.log(`[seed] created admin: ${adminEmail} / ChangeMe!2026 (change this immediately)`);
  }

  const sampleTitles = [
    { title: 'Signal Loss', slug: 'signal-loss', type: 'MOVIE', genres: ['Thriller'], maturityRating: 15, releaseYear: 2024, requiredPlan: 'FREE', videoAssetKey: 'assets/signal-loss.mp4' },
    { title: 'Harborline', slug: 'harborline', type: 'SERIES', genres: ['Drama'], maturityRating: 12, releaseYear: 2023, requiredPlan: 'BASIC', videoAssetKey: 'assets/harborline-s1e1.mp4' },
    { title: 'Quiet Frequencies', slug: 'quiet-frequencies', type: 'MOVIE', genres: ['Sci-Fi'], maturityRating: 13, releaseYear: 2025, requiredPlan: 'STANDARD', videoAssetKey: 'assets/quiet-frequencies.mp4' },
    { title: 'The Long Vault', slug: 'the-long-vault', type: 'SERIES', genres: ['Heist', 'Drama'], maturityRating: 16, releaseYear: 2025, requiredPlan: 'PREMIUM', videoAssetKey: 'assets/the-long-vault-s1e1.mp4' }
  ];

  for (const item of sampleTitles) {
    const existing = await Content.findOne({ slug: item.slug });
    if (!existing) {
      await Content.create({ ...item, isPublished: true, description: `${item.title} — sample seeded title.` });
      console.log(`[seed] created content: ${item.title}`);
    }
  }

  console.log('[seed] done');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
