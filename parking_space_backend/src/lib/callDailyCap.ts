/**
 * QR Calling — the daily masked-call cap per car. This is a single
 * platform-wide admin setting (Setting table, key `qr_call_daily_cap`), not a
 * per-vehicle one: customers cannot set or see a per-car value, only admin
 * can change the number that applies to every car. Mirrors lib/commission.ts.
 */

import { prisma } from './prisma.js';

export const CALL_DAILY_CAP_KEY = 'qr_call_daily_cap';
export const DEFAULT_CALL_DAILY_CAP = 15;

/** Read the current global daily call cap. Falls back to the default. */
export const getCallDailyCap = async (): Promise<number> => {
  const row = await prisma.setting.findUnique({ where: { key: CALL_DAILY_CAP_KEY } });
  if (!row) return DEFAULT_CALL_DAILY_CAP;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : DEFAULT_CALL_DAILY_CAP;
};

/** Persist a new global daily call cap (>= 1). */
export const setCallDailyCap = async (cap: number): Promise<number> => {
  const clamped = Math.max(1, Math.round(cap));
  await prisma.setting.upsert({
    where:  { key: CALL_DAILY_CAP_KEY },
    create: { key: CALL_DAILY_CAP_KEY, value: String(clamped) },
    update: { value: String(clamped) },
  });
  return clamped;
};
