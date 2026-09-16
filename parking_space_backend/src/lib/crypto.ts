import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Field-level encryption for sensitive PII stored by the QR Calling feature
 * (VehicleRegistration.plateNumber / contactPhone / medicalNotes,
 * EmergencyContact.phone). AES-256-GCM with a fresh random IV per value —
 * ciphertext is stored as `iv:tag:data` (base64url), so it round-trips
 * through a plain `@db.Text` column with no schema changes.
 *
 * `hmacHash` is the companion keyed hash used for exact-match lookups
 * (plateHash, callerPhoneHash, ipHash) — deterministic, so equal inputs hash
 * equal, without ever storing or querying the raw value.
 *
 * Both are keyed off QR_DATA_KEY (64 hex chars / 32 bytes) — see .env.example.
 */

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;
const getKey = (): Buffer => {
  if (cachedKey) return cachedKey;
  const key = Buffer.from(env.QR_DATA_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('QR_DATA_KEY must be a 64-character hex string (32 bytes) for AES-256-GCM');
  }
  cachedKey = key;
  return key;
};

export const encryptField = (plain: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString('base64url')).join(':');
};

export const decryptField = (stored: string): string => {
  const [ivB64, tagB64, dataB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted field');
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

/** Keyed HMAC-SHA256 hex digest — for @unique / exact-match columns (plateHash, *PhoneHash, ipHash). */
export const hmacHash = (value: string): string =>
  crypto.createHmac('sha256', getKey()).update(value).digest('hex');

// Domain-separated signing key — derived from QR_DATA_KEY but distinct from
// the raw key used above, so a scan permit signature can never be confused
// with (or substituted for) a field hash/ciphertext keyed the same way.
let cachedPermitKey: Buffer | null = null;
const getPermitKey = (): Buffer => {
  if (!cachedPermitKey) cachedPermitKey = crypto.createHmac('sha256', getKey()).update('scan-permit-v1').digest();
  return cachedPermitKey;
};

/** Keyed HMAC-SHA256, base64url — used to sign/verify the short-lived scan permit (see `lib/scanPermit.ts`). */
export const hmacSign = (value: string): string =>
  crypto.createHmac('sha256', getPermitKey()).update(value).digest('base64url');
