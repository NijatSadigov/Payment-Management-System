// Sandbox online-payment helper (built-in simulated gateway).
// The real provider is Epoint (epoint.az) — see lib/epoint.ts, used in live mode.
// This module powers the no-credentials sandbox: a local checkout page plus an
// HMAC-signed callback that mirrors a real gateway callback.
import crypto from 'crypto';
import { config } from '../config';

// Unguessable order reference used to correlate our payment with the gateway.
export function generateOrderRef(): string {
  return 'EP-' + crypto.randomBytes(9).toString('hex').toUpperCase();
}

// Sandbox callback signature (HMAC over the fields).
export function signCallback(fields: Record<string, string>): string {
  const base = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('&');
  return crypto.createHmac('sha256', config.epoint.privateKey).update(base).digest('hex');
}

export function verifyCallback(fields: Record<string, string>, signature: string): boolean {
  const expected = signCallback(fields);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Sandbox checkout page (stands in for the Epoint hosted payment page).
export function sandboxCheckoutUrl(orderRef: string, returnPath: string): string {
  const q = new URLSearchParams({ ref: orderRef, return: returnPath });
  return `/epay-checkout.html?${q.toString()}`;
}

export const epayInfo = {
  sandbox: config.epoint.sandbox,
  merchantId: config.epoint.publicKey,
  currency: config.epoint.currency,
};
