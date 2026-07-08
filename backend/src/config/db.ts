import mongoose from 'mongoose';
import { env } from './env';

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000
    });
  }
  await connecting;
  console.log('[db] connected to MongoDB');
  return mongoose;
}

mongoose.connection.on('disconnected', () => {
  console.warn('[db] disconnected');
});
mongoose.connection.on('error', (err) => {
  console.error('[db] connection error', err);
});
