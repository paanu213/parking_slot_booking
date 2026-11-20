/**
 * Change history for contact and owner details: who changed what, when, and
 * the old and new values. Stored in AuditLog (action DETAILS_CHANGE). Values
 * can be phone numbers, so they are kept encrypted in the log, like the
 * fields themselves, and only decrypted for the admin history view.
 */
import { prisma } from './prisma.js';
import { decryptField, encryptField } from './crypto.js';

export const DETAILS_CHANGE = 'DETAILS_CHANGE';

export interface DetailChange {
  field: string;      // e.g. contactPhone, ownerName, plateNumber, accountPhone, accountName
  label: string;      // human label shown in admin
  from: string | null;
  to: string | null;
}

/** Record changes (only the ones that actually changed value). */
export const recordDetailChanges = async (args: {
  actorId: string;
  entity: 'VehicleRegistration' | 'User';
  entityId: string;
  changes: DetailChange[];
}) => {
  const real = args.changes.filter((c) => (c.from ?? '') !== (c.to ?? ''));
  if (real.length === 0) return;
  await prisma.auditLog.create({
    data: {
      actorId:  args.actorId,
      action:   DETAILS_CHANGE,
      entity:   args.entity,
      entityId: args.entityId,
      metadata: JSON.stringify({
        changes: real.map((c) => ({
          field: c.field,
          label: c.label,
          from:  c.from ? encryptField(c.from) : null,
          to:    c.to ? encryptField(c.to) : null,
        })),
      }),
    },
  });
};

const safeDecrypt = (v: string | null) => {
  if (!v) return null;
  try { return decryptField(v); } catch { return '(unreadable)'; }
};

/** History for a vehicle and its account holder, newest first, with who made each change. */
export const getDetailsHistory = async (vehicleId: string, userId: string) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: DETAILS_CHANGE,
      OR: [
        { entity: 'VehicleRegistration', entityId: vehicleId },
        { entity: 'User', entityId: userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
  });
  return rows.map((r) => {
    const meta = JSON.parse(r.metadata ?? '{}') as { changes?: { field: string; label: string; from: string | null; to: string | null }[] };
    return {
      id: r.id,
      at: r.createdAt,
      scope: r.entity === 'User' ? 'account' : 'vehicle',
      by: r.actor
        ? { name: r.actor.fullName, email: r.actor.email, role: r.actor.role, isCustomer: r.actor.id === userId }
        : null,
      changes: (meta.changes ?? []).map((c) => ({ field: c.field, label: c.label, from: safeDecrypt(c.from), to: safeDecrypt(c.to) })),
    };
  });
};
