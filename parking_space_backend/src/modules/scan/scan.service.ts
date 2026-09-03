/**
 * Public scan flow (QR Calling, Phase 3) — plate lookup + the opt-in
 * emergency (ICE) card. No auth; the request is scoped only by rate limiting
 * (see `middleware/rateLimit.ts`) and a short-lived signed permit.
 *
 * Deliberately returns no phone number or owner identity from lookup — a
 * match only yields a `permit` that unlocks the ICE card (this phase) and,
 * once telephony is wired (Phase 4), a masked call to the owner.
 */
import type { EmergencyCard, LookupResult } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { decryptField, hmacHash } from '../../lib/crypto.js';
import { issuePermit, verifyPermit } from '../../lib/scanPermit.js';
import { NotFound } from '../../lib/http.js';

const logAttempt = (outcome: 'FOUND' | 'NOT_FOUND' | 'BOT_BLOCKED', plateHash: string | null, ip: string) =>
  prisma.lookupAttempt
    .create({ data: { outcome, plateHash, ipHash: hmacHash(ip) } })
    .catch(() => undefined); // logging is best-effort — never fail the request over it

export const lookupPlate = async (plate: string, ip: string, botToken?: string): Promise<LookupResult> => {
  // Honeypot: real users never populate this hidden field. Log it as bot
  // traffic but respond exactly like a normal miss — no tell for the bot.
  if (botToken) {
    await logAttempt('BOT_BLOCKED', null, ip);
    return { found: false };
  }

  const plateHash = hmacHash(plate); // `plate` already normalized by the LookupInput zod transform
  const registration = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });

  if (!registration || registration.status !== 'ACTIVE') {
    await logAttempt('NOT_FOUND', plateHash, ip);
    return { found: false };
  }

  await logAttempt('FOUND', plateHash, ip);
  return {
    found:        true,
    confirm:      plate,
    hasEmergency: registration.emergencyPublic,
    permit:       issuePermit(registration.id),
  };
};

export const getEmergencyCard = async (permitToken: string): Promise<EmergencyCard> => {
  const registrationId = verifyPermit(permitToken);
  const registration = await prisma.vehicleRegistration.findUnique({
    where:   { id: registrationId },
    include: { emergencyContacts: true },
  });
  if (!registration || registration.status !== 'ACTIVE' || !registration.emergencyPublic) {
    throw NotFound('Emergency card not available');
  }

  return {
    ownerName:    registration.ownerName ?? undefined,
    bloodGroup:   registration.bloodGroup ?? undefined,
    medicalNotes: registration.medicalNotes ? decryptField(registration.medicalNotes) : undefined,
    contacts: [...registration.emergencyContacts]
      .filter((c) => c.showPublic)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ name: c.name, relation: c.relation ?? undefined, phone: decryptField(c.phone) })),
  };
};
