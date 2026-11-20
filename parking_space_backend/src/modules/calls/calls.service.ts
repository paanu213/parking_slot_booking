/**
 * Call engine (QR Calling, Phase 4) — masked bridge between a scanner and a
 * car owner. Enforces the blueprint's limits matrix, then hands off to the
 * pluggable `CallProvider` (Exotel today — see lib/callProviders/exotel.ts;
 * a second vendor drops in later without touching this file's callers).
 * `applyCallEvent` is the single place a call moves through its state
 * machine, hit by the provider's webhook.
 */
import type { CallStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decryptField, encryptField, hmacHash } from '../../lib/crypto.js';
import { verifyPermit } from '../../lib/scanPermit.js';
import { getProvider, type NormalizedCallEvent } from '../../lib/callProviders/index.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { env, exotelVirtualNumbers } from '../../config/env.js';
import { BadRequest, Forbidden, HttpError, NotFound, ServerError, TooMany } from '../../lib/http.js';
import { isUsable } from '../scan/scan.service.js';
import { getCallLimits } from '../../lib/callLimits.js';
import { logger } from '../../config/logger.js';

// Daily limits only count calls that actually connected (or are still in
// flight) — a call that failed to place, was blocked/cancelled, went
// unanswered, busy or declined never used up the caller's allowance.
const COUNTED_STATUSES: CallStatus[] = [
  'INITIATED', 'RINGING_CALLER', 'CALLER_ANSWERED', 'RINGING_OWNER', 'BRIDGED', 'COMPLETED',
];
// Calls that actually rang a phone — the 5-minute cooldown still applies to
// these even when they don't count toward the daily limit, so an unanswered
// call can't be redialled back-to-back and ring the owner repeatedly.
const RANG_STATUSES: CallStatus[] = [...COUNTED_STATUSES, 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED'];

const TERMINAL_STATUSES = new Set([
  'COMPLETED', 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED', 'FAILED', 'BLOCKED', 'CANCELLED',
]);

const toE164 = (raw: string): string => {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const nowHHmmIST = (): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

/** Handles a silentTo < silentFrom window that wraps past midnight (e.g. 22:00 → 07:00). */
const isWithinWindow = (current: string, from: string, to: string): boolean =>
  from <= to ? current >= from && current < to : current >= from || current < to;

const maskPhone = (p: string): string => (p.length > 4 ? `••••${p.slice(-4)}` : '••••');

/**
 * Every active virtual number for a provider, in a stable order — when Exotel
 * has more than one ExoPhone configured (EXOTEL_VIRTUAL_NUMBERS), initiateCall
 * tries them in this order, falling back to the next if one fails to place
 * the call at all (see the retry loop below).
 */
const getActiveVirtualNumbers = async (providerName: string) => {
  const existing = await prisma.virtualNumber.findMany({
    where:   { provider: providerName, isActive: true },
    // Numbers seeded together share a createdAt, so tie-break on id (cuid) to keep the order stable.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (existing.length > 0) return existing;

  // A provider's ExoPhone/virtual number is purchased out-of-band in their
  // dashboard — never invented here.
  if (providerName === 'exotel') {
    if (exotelVirtualNumbers.length === 0) throw new Error('EXOTEL_VIRTUAL_NUMBERS is not configured. Set it in .env');
    return prisma.$transaction(
      exotelVirtualNumbers.map((e164) => prisma.virtualNumber.create({ data: { e164, provider: providerName } })),
    );
  }
  throw new Error(`No virtual number configured for call provider "${providerName}"`);
};

export const initiateCall = async (
  permit: string,
  callerNumberRaw: string,
  ip: string,
  idempotencyKey?: string,
) => {
  const registrationId = verifyPermit(permit);
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id: registrationId } });
  if (!registration || !isUsable(registration)) throw NotFound('This car is not available to call');

  const callerNumber = callerNumberRaw.trim();
  const callerPhoneHash = hmacHash(callerNumber);
  const ipHash = hmacHash(ip);

  // Idempotent replay — a double-tap or client retry with the same key
  // returns the existing session instead of placing a second call.
  if (idempotencyKey) {
    const existing = await prisma.callSession.findUnique({ where: { idempotencyKey } });
    if (existing) {
      // A call that never placed (provider rejected it, no providerCallId) must not be
      // replayed as "failed" forever — release the key so this retry gets a fresh attempt.
      if (existing.status === 'FAILED' && !existing.providerCallId) {
        await prisma.callSession.update({ where: { id: existing.id }, data: { idempotencyKey: null } });
      } else {
        return { callSessionId: existing.id };
      }
    }
  }

  const blocked = await prisma.blockedNumber.findFirst({
    where: {
      phoneHash: callerPhoneHash,
      OR: [{ scope: 'GLOBAL' }, { scope: 'REGISTRATION', registrationId }],
    },
  });
  if (blocked) throw Forbidden('This number has been blocked by the owner');

  if (registration.silentFrom && registration.silentTo && isWithinWindow(nowHHmmIST(), registration.silentFrom, registration.silentTo)) {
    throw BadRequest("The owner isn't taking calls right now. Please try again later.");
  }

  const today = resolveDateRange('day')!;

  // Every limit below is an admin setting (lib/callLimits.ts), read per call so a change applies immediately.
  const [receivedToday, limits] = await Promise.all([
    prisma.callSession.count({ where: { registrationId, status: { in: COUNTED_STATUSES }, createdAt: { gte: today.gte, lte: today.lte } } }),
    getCallLimits(),
  ]);
  if (receivedToday >= limits.perCarDailyCap) {
    throw TooMany('This car has reached its call limit for today. Please try again tomorrow.');
  }

  const successfulToThisCarToday = await prisma.callSession.count({
    where: { registrationId, callerPhoneHash, status: { in: COUNTED_STATUSES }, createdAt: { gte: today.gte, lte: today.lte } },
  });
  if (successfulToThisCarToday >= limits.perCallerPerCarDaily) {
    throw TooMany(`You've already called this car ${limits.perCallerPerCarDaily} times today.`);
  }
  if (limits.cooldownMinutes > 0) {
    const recentlyRang = await prisma.callSession.findFirst({
      where: {
        registrationId, callerPhoneHash, status: { in: RANG_STATUSES },
        initiatedAt: { gte: new Date(Date.now() - limits.cooldownMinutes * 60 * 1000) },
      },
    });
    if (recentlyRang) throw TooMany('Please wait a few minutes before calling this car again.');
  }

  const toAnyCarToday = await prisma.callSession.count({
    where: { callerPhoneHash, status: { in: COUNTED_STATUSES }, createdAt: { gte: today.gte, lte: today.lte } },
  });
  if (toAnyCarToday >= limits.perCallerDaily) throw TooMany("You've reached today's calling limit.");

  const fromThisIpToday = await prisma.callSession.count({
    where: { callerIpHash: ipHash, status: { in: COUNTED_STATUSES }, createdAt: { gte: today.gte, lte: today.lte } },
  });
  if (fromThisIpToday >= limits.perIpDaily) throw TooMany('Too many calls attempted from this network today.');

  const globalToday = await prisma.callSession.count({ where: { status: { in: COUNTED_STATUSES }, createdAt: { gte: today.gte, lte: today.lte } } });
  if (globalToday >= limits.globalDaily) {
    throw TooMany('Calling is temporarily at capacity. Please try again later.');
  }

  const provider = getProvider();
  const virtualNumbers = await getActiveVirtualNumbers(provider.name);

  const session = await prisma.callSession.create({
    data: {
      registrationId,
      provider:        provider.name,
      virtualNumber:   virtualNumbers[0].e164, // placeholder — corrected below to whichever number actually placed the call
      callerPhone:     encryptField(callerNumber),
      callerPhoneHash,
      callerIpHash:    ipHash,
      status:          'INITIATED',
      idempotencyKey:  idempotencyKey ?? null,
    },
  });

  // Try each configured virtual number in order — a call that fails to place
  // outright (bad/exhausted ExoPhone, provider-side rejection, etc.) falls
  // back to the next one instead of failing the whole attempt. This is about
  // the call never placing at all; once a call is actually ringing, a
  // no-answer/busy outcome is the caller's/owner's phone, not the number, so
  // it's never retried here.
  let result: Awaited<ReturnType<typeof provider.initiateMaskedCall>> | undefined;
  let usedNumber = virtualNumbers[0];
  let lastErr: unknown;
  for (const vn of virtualNumbers) {
    try {
      result = await provider.initiateMaskedCall({
        callerE164:    toE164(callerNumber),
        ownerE164:     toE164(decryptField(registration.contactPhone)),
        virtualNumber: vn.e164,
        sessionId:     session.id,
      });
      usedNumber = vn;
      break;
    } catch (e) {
      lastErr = e;
      logger.warn(
        { event: 'call_virtual_number_failed', provider: provider.name, virtualNumber: vn.e164, err: e },
        'Call provider rejected this virtual number, trying the next one',
      );
    }
  }

  if (!result) {
    const debug = (lastErr as { debug?: unknown } | undefined)?.debug;
    await prisma.callSession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED', endedAt: new Date(),
        rawPayload: JSON.stringify({ placementFailed: true, error: lastErr instanceof Error ? lastErr.message : String(lastErr), debug }),
      },
    });
    throw lastErr instanceof HttpError ? lastErr : ServerError('Could not place the call, please try again');
  }

  await prisma.callSession.update({
    where: { id: session.id },
    data:  { providerCallId: result.providerCallId, virtualNumber: usedNumber.e164, rawPayload: JSON.stringify(result.raw) },
  });

  return { callSessionId: session.id };
};

export const getCallStatus = async (id: string) => {
  const session = await prisma.callSession.findUnique({
    where:  { id },
    select: { id: true, status: true, initiatedAt: true, answeredAt: true, endedAt: true, durationSec: true },
  });
  if (!session) throw NotFound('Call not found');
  return session;
};

/**
 * The one place a CallSession advances — driven by a real provider's webhook
 * (via /webhooks/call/:provider) or the mock's in-process simulation.
 * Idempotent: an unknown providerCallId is ignored, and a session already in
 * a terminal state never gets reprocessed (dedupe against retried/reordered
 * webhook deliveries, per the blueprint's reliability requirements).
 */
export const applyCallEvent = async (providerName: string, evt: NormalizedCallEvent): Promise<void> => {
  const session = await prisma.callSession.findFirst({
    where: { providerCallId: evt.providerCallId, provider: providerName },
  });
  if (!session || TERMINAL_STATUSES.has(session.status)) return;

  const data: Prisma.CallSessionUpdateInput = { status: evt.status, rawPayload: JSON.stringify(evt.raw) };
  if ((evt.status === 'CALLER_ANSWERED' || evt.status === 'BRIDGED') && !session.answeredAt) {
    data.answeredAt = new Date();
  }
  if (TERMINAL_STATUSES.has(evt.status)) {
    data.endedAt = new Date();
    if (evt.durationSec !== undefined) data.durationSec = evt.durationSec;
    if (evt.hangupCause) data.hangupCause = evt.hangupCause;
    if (evt.recordingUrl) data.recordingUrl = evt.recordingUrl;
    if (evt.costPaise !== undefined) data.costPaise = evt.costPaise;
  }

  await prisma.callSession.update({ where: { id: session.id }, data });
};

// ── Owner-facing call log ───────────────────────────────────────────────────

export const listCallsForOwner = async (userId: string, registrationId: string) => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id: registrationId } });
  if (!registration || registration.userId !== userId) throw NotFound('Vehicle not found');

  const rows = await prisma.callSession.findMany({
    where:   { registrationId },
    orderBy: { initiatedAt: 'desc' },
    take:    50,
  });
  return rows.map((r) => ({
    id:           r.id,
    status:       r.status,
    initiatedAt:  r.initiatedAt,
    answeredAt:   r.answeredAt,
    endedAt:      r.endedAt,
    durationSec:  r.durationSec,
    callerMasked: maskPhone(decryptField(r.callerPhone)),
  }));
};

export const blockCaller = async (userId: string, registrationId: string, callSessionId: string) => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id: registrationId } });
  if (!registration || registration.userId !== userId) throw NotFound('Vehicle not found');

  const session = await prisma.callSession.findUnique({ where: { id: callSessionId } });
  if (!session || session.registrationId !== registrationId || !session.callerPhoneHash) {
    throw NotFound('Call not found');
  }

  const existing = await prisma.blockedNumber.findFirst({
    where: { phoneHash: session.callerPhoneHash, scope: 'REGISTRATION', registrationId },
  });
  if (!existing) {
    await prisma.blockedNumber.create({
      data: { phoneHash: session.callerPhoneHash, scope: 'REGISTRATION', registrationId, createdById: userId },
    });
  }
  return { blocked: true };
};
