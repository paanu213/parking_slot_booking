/**
 * Provider call-status webhooks — POST /api/webhooks/call/:provider.
 * No auth (providers can't send our session cookies/JWTs); real adapters
 * must verify the provider's own signature/IP-allowlist inside
 * `parseWebhook` before this is trusted with a real vendor.
 *
 * Always acks fast (200) regardless of outcome — per the blueprint's
 * reliability notes, a slow or error response just makes providers retry
 * harder. `applyCallEvent` is idempotent, so a retried/duplicated delivery
 * is always safe to reprocess.
 */
import { Router } from 'express';
import { getProvider } from '../../lib/callProviders/index.js';
import { applyCallEvent } from '../calls/calls.service.js';
import { logger } from '../../config/logger.js';

const r = Router();

r.post('/call/:provider', async (req, res) => {
  try {
    const provider = getProvider(req.params.provider);
    const event = provider.parseWebhook(req.body);
    await applyCallEvent(provider.name, event);
  } catch (err) {
    logger.warn({ err, provider: req.params.provider }, 'call webhook processing failed');
  }
  res.sendStatus(200);
});

export default r;
