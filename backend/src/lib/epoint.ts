// Epoint (epoint.az) live gateway adapter.
//
// Epoint's card-payment flow:
//   1. POST { data, signature } to  <baseUrl>/request
//        data      = base64(JSON.stringify(payload))
//        signature = base64( sha1_raw( private_key + data + private_key ) )
//   2. Response JSON: { status: 'success', redirect_url } — send the payer there.
//   3. Epoint calls your result URL (server-to-server) with the SAME
//        { data, signature } shape; verify the signature, then base64-decode
//        `data` to read { order_id, status: 'success'|'failed', transaction }.
//
// NOTE: written to Epoint's documented API but NOT yet tested against a real
// merchant account. Validate with Epoint TEST keys before going live.
import crypto from 'crypto';
import { config } from '../config';

// signature = base64( sha1( privateKey + data + privateKey ) )  [raw bytes]
export function epointSignature(dataB64: string): string {
  return crypto
    .createHash('sha1')
    .update(config.epoint.privateKey + dataB64 + config.epoint.privateKey)
    .digest('base64');
}

export function encodePayload(payload: Record<string, unknown>): { data: string; signature: string } {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { data, signature: epointSignature(data) };
}

export function verifyEpointCallback(data: string, signature: string): boolean {
  const expected = epointSignature(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function decodeCallback(data: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeLang(lang: string): string {
  return ['az', 'en', 'ru'].includes(lang) ? lang : 'az';
}

// Create a card payment and return the hosted-page URL to redirect the payer to.
export async function createOnlinePayment(opts: {
  orderRef: string;
  amount: number;
  description: string;
  language: string;
  successUrl: string;
  errorUrl: string;
}): Promise<{ redirectUrl: string }> {
  const payload = {
    public_key: config.epoint.publicKey,
    amount: opts.amount.toFixed(2),
    currency: config.epoint.currency,
    language: normalizeLang(opts.language),
    order_id: opts.orderRef,
    description: opts.description,
    success_redirect_url: opts.successUrl,
    error_redirect_url: opts.errorUrl,
  };
  const { data, signature } = encodePayload(payload);

  const res = await fetch(`${config.epoint.baseUrl}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data, signature }).toString(),
  });
  const json = (await res.json().catch(() => null)) as
    | { status?: string; redirect_url?: string; message?: string }
    | null;

  if (!json || json.status !== 'success' || !json.redirect_url) {
    throw new Error(json?.message || 'Epoint payment could not be created');
  }
  return { redirectUrl: json.redirect_url };
}
