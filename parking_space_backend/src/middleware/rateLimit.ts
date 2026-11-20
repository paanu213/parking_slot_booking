import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { hmacHash } from '../lib/crypto.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Razorpay's own retry/burst behavior (and a webhook-secret HMAC check
  // right behind this) shouldn't ever get 429'd by the generic per-IP cap —
  // a dropped webhook means a payment/refund silently never reconciles.
  skip: (req) => req.path.startsWith('/api/webhooks'),
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

// Payment checkout/verify — generous enough for a genuine customer retrying
// a few times after a card decline or a flaky network, tight enough that a
// script can't hammer Razorpay order-creation (real cost, real API) or brute
// force the verify endpoint's signature check.
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many payment attempts, please wait a few minutes and try again' } },
});

// QR Calling public plate lookup — "15/hour + bot-check" per the blueprint's
// limits matrix. Logs the block to LookupAttempt (for admin abuse visibility
// later) before responding, best-effort so a logging hiccup never blocks the 429.
export const scanLookupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: async (req, res) => {
    try {
      await prisma.lookupAttempt.create({
        data: { ipHash: hmacHash(req.ip ?? 'unknown'), outcome: 'RATE_LIMITED' },
      });
    } catch {
      /* logging is best-effort */
    }
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many lookups, try again later' } });
  },
});
