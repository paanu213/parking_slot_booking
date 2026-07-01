/**
 * Util service — domain logic for the small cross-cutting helpers.
 *
 * Pincode lookups are proxied through the backend because the upstream
 * `api.postalpincode.in` frequently serves expired SSL certs, which break
 * browser fetch() with ERR_CERT_DATE_INVALID. We tolerate that with an
 * insecure agent (the postal data is public and non-sensitive).
 */
import https from 'node:https';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/http.js';
import type { LeadInput } from './util.schema.js';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

interface PostOffice {
  Name?: string;
  Block?: string;
  Division?: string;
  District?: string;
  State?: string;
  Country?: string;
  Pincode?: string;
}

export interface PincodeLookup {
  pincode: string;
  /**
   * Best-effort City / Town. The India Post API has no exact "city" field, so we
   * use the postal Block (the town/mandal — e.g. "Rajahmundry" when the District
   * is "East Godavari"), falling back to Division/District. Editable in the form.
   */
  city: string;
  district: string;
  state: string;
  area: string;
  places: { name: string; district: string; state: string }[];
}

export const lookupPincode = async (raw: string): Promise<PincodeLookup> => {
  const pincode = String(raw).replace(/\D/g, '');
  if (pincode.length !== 6) {
    throw new HttpError(400, 'Pincode must be 6 digits', 'BAD_PINCODE');
  }

  let data: Array<{ Status?: string; PostOffice?: PostOffice[] | null }>;
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      // @ts-expect-error — node fetch accepts dispatcher/agent in this runtime
      agent: insecureAgent,
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    data = (await response.json()) as Array<{ Status?: string; PostOffice?: PostOffice[] | null }>;
  } catch {
    // Don't surface a 500 — clients fall back to manual entry on a 502.
    throw new HttpError(502, 'Upstream pincode service unreachable', 'PINCODE_LOOKUP_FAILED');
  }

  const first = data?.[0];
  const offices = first?.PostOffice ?? [];
  if (first?.Status !== 'Success' || offices.length === 0) {
    throw new HttpError(404, 'Pincode not found', 'PINCODE_NOT_FOUND');
  }

  const po = offices[0];
  const district = po.District ?? po.Block ?? po.Name ?? '';
  // Best-effort City / Town. The postal Division is the cleanest city name
  // ("Rajahmundry", "Visakhapatnam", "Hyderabad City"); Block is noisier
  // ("Rajahmundry (Urban)", "Khairatabad"). Strip postal suffixes; fall back to
  // Block, then District. Stays editable in the form.
  const clean = (s?: string) =>
    (s ?? '')
      .replace(/\s*\([^)]*\)\s*$/, '')      // drop trailing "(Urban)", "(mdl)", …
      .replace(/\s+(urban|rural|city)$/i, '') // drop stray "Urban"/"Rural"/"City"
      .trim();
  const city = clean(po.Division) || clean(po.Block) || district;
  return {
    pincode,
    city,
    district,
    state: po.State ?? '',
    area:  po.Name ?? po.Block ?? '',
    places: offices.map((p) => ({
      name:     p.Name ?? '',
      district: p.District ?? '',
      state:    p.State ?? '',
    })),
  };
};

/**
 * Persist a "List your space" lead (reviewable on the admin Vendors/Requests
 * page) plus an audit-log entry.
 */
export const createVendorLead = async (
  data: LeadInput,
  meta: { ip?: string; userAgent?: string | null },
) => {
  const lead = await prisma.vendorLead.create({
    data: {
      leadType:        data.leadType,
      serviceCategory: data.serviceCategory ?? null,
      businessName: data.businessName,
      fullName:     data.fullName,
      email:        data.email,
      phone:        data.phone,
      city:         data.city,
      slotsApprox:  data.slotsApprox ?? null,
      notes:        data.notes ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      action:   'VENDOR_LEAD_SUBMIT',
      entity:   'VendorLead',
      entityId: lead.id,
      ip:       meta.ip,
      metadata: JSON.stringify({
        email:        data.email,
        businessName: data.businessName,
        userAgent:    meta.userAgent ?? null,
      }),
    },
  });
  return lead;
};
