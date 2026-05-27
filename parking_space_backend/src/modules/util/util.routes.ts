/**
 * Utility endpoints used by the frontends — small helpers that don't
 * belong to any specific domain (e.g. pincode lookup proxy).
 *
 * Why a backend proxy for pincode lookups?
 *   The third-party `api.postalpincode.in` has frequent SSL certificate
 *   expirations which cause browser fetch() calls to fail with
 *   ERR_CERT_DATE_INVALID. Proxying through our backend with
 *   `rejectUnauthorized: false` keeps the data flowing regardless.
 */

import { Router } from 'express';
import https from 'node:https';

const r = Router();

// HTTPS agent that tolerates expired/invalid certs on the upstream API.
// Safe here because the postal data is public and non-sensitive.
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

interface PostOffice {
  Name?: string;
  Block?: string;
  District?: string;
  State?: string;
  Country?: string;
  Pincode?: string;
}

/**
 * GET /api/util/pincode/:pincode
 * Returns: { city, state, area, places: [...] } or 404 if pincode unknown.
 */
r.get('/pincode/:pincode', async (req, res) => {
  const pincode = String(req.params.pincode).replace(/\D/g, '');
  if (pincode.length !== 6) {
    return res.status(400).json({ error: { code: 'BAD_PINCODE', message: 'Pincode must be 6 digits' } });
  }

  try {
    const upstream = `https://api.postalpincode.in/pincode/${pincode}`;
    const response = await fetch(upstream, {
      // @ts-expect-error — node fetch accepts dispatcher/agent in this runtime
      agent: insecureAgent,
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);

    const data = (await response.json()) as Array<{
      Status?: string;
      PostOffice?: PostOffice[] | null;
    }>;

    const first = data?.[0];
    const offices = first?.PostOffice ?? [];
    if (first?.Status !== 'Success' || offices.length === 0) {
      return res.status(404).json({
        error: { code: 'PINCODE_NOT_FOUND', message: 'Pincode not found' },
      });
    }

    const po = offices[0];
    res.json({
      pincode,
      city:  po.District ?? po.Block ?? po.Name ?? '',
      state: po.State ?? '',
      area:  po.Name ?? po.Block ?? '',
      places: offices.map((p) => ({
        name:     p.Name ?? '',
        district: p.District ?? '',
        state:    p.State ?? '',
      })),
    });
  } catch (err) {
    // Don't 500 on upstream issues — clients are designed to fall back to manual entry.
    res.status(502).json({
      error: { code: 'PINCODE_LOOKUP_FAILED', message: 'Upstream pincode service unreachable' },
    });
  }
});

export default r;
