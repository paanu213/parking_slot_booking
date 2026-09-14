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
import { getGateway } from '../../lib/paymentGateway/index.js';
import { applyCallEvent } from '../calls/calls.service.js';
import { applyRazorpayWebhookEvent } from '../payments/payments.service.js';
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

/**
 * Razorpay webhook — reconciliation path for both booking and QR-order
 * payments (see payments.service `applyRazorpayWebhookEvent`). The signature
 * is an HMAC over the *raw* request bytes (req.rawBody, captured by
 * express.json()'s `verify` in app.ts), so this must run before anything
 * re-serialises the body. A bad/missing signature is rejected with 400 and
 * never reaches the handler — this is the one payment code path an outside
 * party can call directly, so it's the one that must never trust its input
 * without that check passing first.
 */
r.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;
  const gateway = getGateway();

  if (!rawBody || typeof signature !== 'string' || !gateway.verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ event: 'razorpay_webhook_bad_signature', hasBody: !!rawBody, hasSignature: !!signature }, 'Rejected Razorpay webhook — signature did not verify');
    res.sendStatus(400);
    return;
  }

  try {
    const event = gateway.parseWebhookEvent(rawBody);
    await applyRazorpayWebhookEvent(event);
  } catch (err) {
    // Ack anyway — a bug on our side shouldn't turn into a Razorpay retry
    // storm. The next verify call / manual admin reconciliation covers it.
    logger.error({ err }, 'razorpay webhook processing failed');
  }
  res.sendStatus(200);
});

export default r;
