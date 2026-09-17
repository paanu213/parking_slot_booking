/**
 * Exotel — real telephony via the Voice v1 "Connect two numbers" API
 * (POST /v1/Accounts/:sid/Calls/connect). Dials `From` first; once that leg
 * answers, dials `To` and bridges them — which is exactly the caller-then-
 * owner sequence this feature needs, so callerE164 is From and ownerE164 is
 * To (neither ever sees the other's real number, only the ExoPhone).
 *
 * Docs: https://developer.exotel.com/docs/voice-v1/api-reference/connect-two-numbers
 * Auth: HTTP Basic, api_key:api_token. Base URL: https://<subdomain>/v1/Accounts/<sid>/
 *
 * Exotel's StatusCallback has no signature/HMAC — see EXOTEL_WEBHOOK_SECRET in
 * env.ts and the check in modules/webhooks/webhooks.routes.ts; parseWebhook
 * here only maps the payload, it doesn't (and can't) verify authenticity.
 */
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ServerError } from '../../lib/http.js';
import type {
  CallProvider, InitiateMaskedCallParams, InitiateMaskedCallResult, NormalizedCallEvent, NormalizedCallStatus,
} from './types.js';

interface ExotelCallResponse {
  Call?: { Sid: string; Status: string; [k: string]: unknown };
  RestException?: { Status: number; Message: string };
}

const authHeader = () =>
  'Basic ' + Buffer.from(`${env.EXOTEL_API_KEY}:${env.EXOTEL_API_TOKEN}`).toString('base64');

const baseUrl = () => `https://${env.EXOTEL_SUBDOMAIN}/v1/Accounts/${env.EXOTEL_ACCOUNT_SID}`;

/** Callback URL Exotel posts call-lifecycle updates to — the secret query param is checked in webhooks.routes.ts. */
const statusCallbackUrl = () =>
  `${env.API_BASE_URL}/api/webhooks/call/exotel?token=${encodeURIComponent(env.EXOTEL_WEBHOOK_SECRET ?? '')}`;

export const exotelProvider: CallProvider = {
  name: 'exotel',

  async initiateMaskedCall(p: InitiateMaskedCallParams): Promise<InitiateMaskedCallResult> {
    if (!env.EXOTEL_API_KEY || !env.EXOTEL_API_TOKEN || !env.EXOTEL_ACCOUNT_SID) {
      throw ServerError('Exotel is not configured — set EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID');
    }

    const form = new URLSearchParams({
      From:       p.callerE164,
      To:         p.ownerE164,
      CallerId:   p.virtualNumber,
      CallType:   'trans',
      TimeLimit:  '3600', // 1hr hard cap — a masked scan-to-call has no business running longer
      TimeOut:    '30',
      Record:     p.record ? 'true' : 'false',
      CustomField: p.sessionId.slice(0, 128),
      StatusCallback: statusCallbackUrl(),
      StatusCallbackEvents: 'terminal,answered',
    });

    const res = await fetch(`${baseUrl()}/Calls/connect.json`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const body = (await res.json().catch(() => null)) as ExotelCallResponse | null;

    if (!res.ok || !body?.Call?.Sid) {
      const message = body?.RestException?.Message ?? `HTTP ${res.status}`;
      logger.error({ event: 'exotel_call_create_failed', status: res.status, body }, 'Exotel call creation failed');
      throw ServerError(`Exotel call could not be placed: ${message}`);
    }

    return { providerCallId: body.Call.Sid, status: body.Call.Status, raw: body };
  },

  parseWebhook(body: unknown): NormalizedCallEvent {
    const b = (body ?? {}) as Record<string, string | undefined>;
    const callSid = b.CallSid ?? b.Sid ?? '';
    // Exotel reports the callee (owner) leg as DialCallStatus/Leg2Status; Status/
    // CallStatus is the overall call status. Check the more specific field first.
    const rawStatus = (b.DialCallStatus ?? b.Leg2Status ?? b.Status ?? b.CallStatus ?? '').toLowerCase();

    const status: NormalizedCallStatus = (() => {
      switch (rawStatus) {
        case 'in-progress': return 'BRIDGED';
        case 'completed':   return 'COMPLETED';
        case 'no-answer':   return 'NO_ANSWER';
        case 'busy':        return 'BUSY';
        case 'failed':      return 'FAILED';
        case 'canceled':
        case 'cancelled':   return 'FAILED';
        default:
          logger.warn({ event: 'exotel_webhook_unknown_status', rawStatus, body }, 'Unrecognized Exotel call status — defaulting to FAILED');
          return 'FAILED';
      }
    })();

    const durationSec = b.DialCallDuration ?? b.Duration;
    const priceRupees = b.Price;

    return {
      providerCallId: callSid,
      status,
      recordingUrl: b.RecordingUrl || undefined,
      durationSec:  durationSec ? Number(durationSec) : undefined,
      costPaise:    priceRupees ? Math.round(Math.abs(Number(priceRupees)) * 100) : undefined,
      raw: body,
    };
  },
};
