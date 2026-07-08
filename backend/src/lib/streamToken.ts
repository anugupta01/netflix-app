import { createHmac } from 'crypto';
import { env } from '../config/env';

// Short-lived, signed streaming URLs: the frontend never receives the raw
// videoAssetKey (that field has select:false on the Content model). Instead
// it gets an opaque, time-limited, tamper-evident token that a CDN/edge
// function would verify before serving bytes. This stops URL sharing from
// granting indefinite/free access, and stops a client from requesting an
// arbitrary asset key it was never authorized for.
interface StreamTokenPayload {
  contentId: string;
  profileId: string;
  exp: number; // unix seconds
}

export function issueStreamToken(payload: Omit<StreamTokenPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + env.streamUrlTtlSeconds;
  const body = JSON.stringify({ ...payload, exp });
  const encodedBody = Buffer.from(body).toString('base64url');
  const signature = createHmac('sha256', env.streamUrlSecret).update(encodedBody).digest('base64url');
  return `${encodedBody}.${signature}`;
}

export function verifyStreamToken(token: string): StreamTokenPayload | null {
  const [encodedBody, signature] = token.split('.');
  if (!encodedBody || !signature) return null;

  const expectedSignature = createHmac('sha256', env.streamUrlSecret).update(encodedBody).digest('base64url');

  // Constant-time-ish comparison via length check + Buffer.compare would be
  // ideal in a high-security production setting; shown simply here for clarity.
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8')) as StreamTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
