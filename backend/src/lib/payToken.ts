// Stateless, unguessable public payment-link token for a customer.
// Format: "<customerId>.<senderId>.<hmac>" where senderId is the user who
// generated/sent the link (so self-service payments credit the sender).
// Legacy 2-part tokens ("<id>.<hmac>") are still accepted (senderId = null).
// No DB column needed. Rotating JWT_SECRET invalidates all links at once.
import crypto from 'crypto';
import { config } from '../config';

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', config.jwtSecret + ':paylink')
    .update(payload)
    .digest('hex')
    .slice(0, 24);
}

export function makePayToken(customerId: number, senderId: number | null = null): string {
  const sender = senderId ?? 0;
  return `${customerId}.${sender}.${sign(`${customerId}.${sender}`)}`;
}

export interface PayTokenData {
  customerId: number;
  senderId: number | null;
}

export function parsePayToken(token: string): PayTokenData | null {
  if (!token) return null;
  const parts = token.split('.');

  // New 3-part format.
  if (parts.length === 3) {
    const customerId = Number(parts[0]);
    const sender = Number(parts[1]);
    if (!Number.isInteger(customerId) || customerId <= 0 || !Number.isInteger(sender)) return null;
    const expected = sign(`${customerId}.${sender}`);
    if (!safeEqual(expected, parts[2])) return null;
    return { customerId, senderId: sender > 0 ? sender : null };
  }

  // Legacy 2-part format (no sender).
  if (parts.length === 2) {
    const customerId = Number(parts[0]);
    if (!Number.isInteger(customerId) || customerId <= 0) return null;
    const legacy = crypto
      .createHmac('sha256', config.jwtSecret + ':paylink')
      .update(String(customerId))
      .digest('hex')
      .slice(0, 24);
    if (!safeEqual(legacy, parts[1])) return null;
    return { customerId, senderId: null };
  }

  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b || '');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
