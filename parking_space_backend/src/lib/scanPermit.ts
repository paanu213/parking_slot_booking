import crypto from 'node:crypto';
import { BadRequest } from './http.js';
import { hmacSign } from './crypto.js';

const signaturesMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch — a forged/truncated sig is common, not exceptional.
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Short-lived signed token handed back from `POST /c/lookup` on a match.
 * Scopes the follow-up `/c/emergency` (and, later, `/c/call`) request to the
 * one registration that was just resolved — a scanner can't reuse a permit
 * to probe a different plate, and it self-expires so it can't be replayed
 * hours later. Not a JWT: just `payload.signature`, both base64url, HMAC'd
 * with a key domain-separated from field encryption (see crypto.ts).
 */

interface PermitPayload {
  rid: string; // VehicleRegistration.id
  exp: number; // epoch ms
}

const DEFAULT_TTL_SEC = 10 * 60; // 10 minutes — long enough to tap Call/Emergency, short enough to not be worth hoarding

export const issuePermit = (registrationId: string, ttlSec = DEFAULT_TTL_SEC): string => {
  const payload: PermitPayload = { rid: registrationId, exp: Date.now() + ttlSec * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${hmacSign(data)}`;
};

/** Returns the registration id, or throws a 400 if the permit is malformed, forged, or expired. */
export const verifyPermit = (permit: string): string => {
  const [data, sig] = String(permit ?? '').split('.');
  if (!data || !sig || !signaturesMatch(hmacSign(data), sig)) {
    throw BadRequest('Invalid or expired link, please scan again');
  }
  let payload: PermitPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    throw BadRequest('Invalid or expired link, please scan again');
  }
  if (typeof payload.rid !== 'string' || Date.now() > payload.exp) {
    throw BadRequest('Invalid or expired link, please scan again');
  }
  return payload.rid;
};
