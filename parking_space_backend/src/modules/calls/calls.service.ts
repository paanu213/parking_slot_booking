/**
 * Call engine (QR Calling, Phase 4) — masked bridge between a scanner and a
 * car owner. Enforces the blueprint's limits matrix, then hands off to the
 * pluggable `CallProvider` (mock today; a real vendor drops in later without
 * touching this file's callers). `applyCallEvent` is the single place a call
 * moves through its state machine — hit by a real provider's webhook, or by
 * the mock provider's in-process simulation, identically.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decryptField, encryptField, hmacHash } from '../../lib/crypto.js';
import { verifyPermit } from '../../lib/scanPermit.js';
import { getProvider, type NormalizedCallEvent } from '../../lib/callProviders/index.js';
import { simulateMockProgress } from '../../lib/callProviders/mock.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { env, exotelVirtualNumbers } from '../../config/env.js';
import { BadRequest, Forbidden, HttpError, NotFound, ServerError, TooMany } from '../../lib/http.js';
import { isUsable } from '../scan/scan.service.js';
import { getCallDailyCap } from '../../lib/callDailyCap.js';
import { logger } from '../../config/logger.js';

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
    orderBy: { createdAt: 'asc' },
  });
  if (existing.length > 0) return existing;

  // A real provider's ExoPhone/virtual number is purchased out-of-band in
  // their dashboard, not invented here — mock is the only one allowed to
  // make one up, since it never places a real call.
  if (providerName === 'exotel') {
    if (exotelVirtualNumbers.length === 0) throw new Error('EXOTEL_VIRTUAL_NUMBERS is not configured — set it in .env');
    return prisma.$transaction(
      exotelVirtualNumbers.map((e164) => prisma.virtualNumber.create({ data: { e164, provider: providerName } })),
    );
  }
  const created = await prisma.virtualNumber.create({
    data: { e164: `+91${providerName === 'mock' ? '80MOCKVN01' : 'UNSET00001'}`, provider: providerName },
  });
  return [created];
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
    if (existing) return { callSessionId: existing.id };
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

  const [receivedToday, dailyCap] = await Promise.all([
    prisma.callSession.count({ where: { registrationId, createdAt: { gte: today.gte, lte: today.lte } } }),
    getCallDailyCap(),
  ]);
  if (receivedToday >= dailyCap) {
    throw TooMany('This car has reached its call limit for today. Please try again tomorrow.');
  }

  const toThisCarToday = await prisma.callSession.findMany({
    where: { registrationId, callerPhoneHash, createdAt: { gte: today.gte, lte: today.lte } },
    orderBy: { initiatedAt: 'desc' },
    take: 2,
  });
  if (toThisCarToday.length >= 2) throw TooMany("You've already called this car twice today.");
  if (toThisCarToday.length > 0 && Date.now() - toThisCarToday[0].initiatedAt.getTime() < 5 * 60 * 1000) {
    throw TooMany('Please wait a few minutes before calling this car again.');
  }

  const toAnyCarToday = await prisma.callSession.count({
    where: { callerPhoneHash, createdAt: { gte: today.gte, lte: today.lte } },
  });
  if (toAnyCarToday >= 6) throw TooMany("You've reached today's calling limit.");

  const fromThisIpToday = await prisma.callSession.count({
    where: { callerIpHash: ipHash, createdAt: { gte: today.gte, lte: today.lte } },
  });
  if (fromThisIpToday >= 10) throw TooMany('Too many calls attempted from this network today.');

  const globalToday = await prisma.callSession.count({ where: { createdAt: { gte: today.gte, lte: today.lte } } });
  if (globalToday >= env.CALL_GLOBAL_DAILY_CAP) {
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
        'Call provider rejected this virtual number — trying the next one',
      );
    }
  }

  if (!result) {
    await prisma.callSession.update({ where: { id: session.id }, data: { status: 'FAILED', endedAt: new Date() } });
    throw lastErr instanceof HttpError ? lastErr : ServerError('Could not place the call — please try again');
  }

  await prisma.callSession.update({
    where: { id: session.id },
    data:  { providerCallId: result.providerCallId, virtualNumber: usedNumber.e164, rawPayload: JSON.stringify(result.raw) },
  });

  if (provider.name === 'mock') {
    simulateMockProgress(result.providerCallId, (evt) => applyCallEvent(provider.name, evt));
  }

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
