/**
 * Commission helpers — single source of truth for the company's cut on bookings.
 *
 * The rate is stored in the Setting table under `commission_rate` (as a percent
 * string, e.g. "10"). It's snapshotted onto each booking at creation time so
 * later rate changes never rewrite historical commission amounts.
 */

import { prisma } from './prisma.js';

export const COMMISSION_RATE_KEY = 'commission_rate';
export const DEFAULT_COMMISSION_RATE = 10;

/** Read the current commission rate (percent). Falls back to the default. */
export const getCommissionRate = async (): Promise<number> => {
  const row = await prisma.setting.findUnique({ where: { key: COMMISSION_RATE_KEY } });
  if (!row) return DEFAULT_COMMISSION_RATE;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COMMISSION_RATE;
};

/** Persist a new commission rate (percent, 0–100). */
export const setCommissionRate = async (rate: number): Promise<number> => {
  const clamped = Math.min(100, Math.max(0, rate));
  await prisma.setting.upsert({
    where:  { key: COMMISSION_RATE_KEY },
    create: { key: COMMISSION_RATE_KEY, value: String(clamped) },
    update: { value: String(clamped) },
  });
  return clamped;
};

/** Commission amount for a booking total at a given rate, rounded to 2 dp. */
export const commissionFor = (totalAmount: number, rate: number): number =>
  Math.round(totalAmount * rate) / 100;
