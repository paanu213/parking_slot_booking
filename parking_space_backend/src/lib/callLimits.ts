/**
 * QR Calling — every abuse/cost limit on masked calls, as platform-wide admin
 * settings (Setting table) instead of constants in the code. Customers can't
 * see or change any of these. Mirrors lib/commission.ts: a missing/garbled row
 * falls back to the default, and values are clamped to the bounds on write.
 *
 * `qr_call_daily_cap` keeps its original key so the value already saved by
 * the older single-setting UI carries over.
 */
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

export interface CallLimitDef {
  key: string;
  label: string;
  description: string;
  unit: string;
  default: number;
  min: number;
  max: number;
}

export const CALL_LIMIT_DEFS = {
  perCarDailyCap: {
    key: 'qr_call_daily_cap',
    label: 'Calls per car, per day',
    description: 'The most calls any one car can receive in a day, from everyone combined.',
    unit: 'calls/day', default: 15, min: 1, max: 500,
  },
  perCallerPerCarDaily: {
    key: 'qr_call_per_caller_per_car',
    label: 'Calls per caller to one car, per day',
    description: 'How many times the same person can call the same car in a day.',
    unit: 'calls/day', default: 5, min: 1, max: 100,
  },
  cooldownMinutes: {
    key: 'qr_call_cooldown_minutes',
    label: 'Wait between calls to the same car',
    description: 'Minimum gap before the same person can ring the same car again. 0 turns the wait off.',
    unit: 'minutes', default: 5, min: 0, max: 120,
  },
  perCallerDaily: {
    key: 'qr_call_per_caller_daily',
    label: 'Calls per caller, all cars, per day',
    description: 'Total calls one phone number can make in a day, across every car.',
    unit: 'calls/day', default: 6, min: 1, max: 200,
  },
  perIpDaily: {
    key: 'qr_call_per_ip_daily',
    label: 'Calls per network address, per day',
    description: 'Total calls from one internet connection (IP address) in a day.',
    unit: 'calls/day', default: 10, min: 1, max: 500,
  },
  globalDaily: {
    key: 'qr_call_global_daily',
    label: 'Platform-wide calls per day',
    description: 'Overall cost guard — total calls across all cars and callers in a day.',
    unit: 'calls/day', default: env.CALL_GLOBAL_DAILY_CAP, min: 1, max: 100000,
  },
} as const satisfies Record<string, CallLimitDef>;

export type CallLimitName = keyof typeof CALL_LIMIT_DEFS;
export type CallLimits = Record<CallLimitName, number>;

const NAMES = Object.keys(CALL_LIMIT_DEFS) as CallLimitName[];

const parse = (def: CallLimitDef, raw: string | undefined): number => {
  if (raw === undefined) return def.default;
  const n = Number(raw);
  return Number.isFinite(n) && n >= def.min && n <= def.max ? Math.round(n) : def.default;
};

/** All current limits in one query. */
export const getCallLimits = async (): Promise<CallLimits> => {
  const rows = await prisma.setting.findMany({ where: { key: { in: NAMES.map((n) => CALL_LIMIT_DEFS[n].key) } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(NAMES.map((n) => [n, parse(CALL_LIMIT_DEFS[n], byKey.get(CALL_LIMIT_DEFS[n].key))])) as CallLimits;
};

/** Save any subset of the limits (each clamped to its bounds); returns the full set. */
export const setCallLimits = async (patch: Partial<CallLimits>): Promise<CallLimits> => {
  for (const name of NAMES) {
    const v = patch[name];
    if (v === undefined) continue;
    const def = CALL_LIMIT_DEFS[name];
    const clamped = Math.min(def.max, Math.max(def.min, Math.round(Number(v))));
    await prisma.setting.upsert({
      where:  { key: def.key },
      create: { key: def.key, value: String(clamped) },
      update: { value: String(clamped) },
    });
  }
  return getCallLimits();
};
