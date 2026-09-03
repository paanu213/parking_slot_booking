import crypto from 'node:crypto';
import type {
  CallProvider, InitiateMaskedCallParams, InitiateMaskedCallResult, NormalizedCallEvent,
} from './types.js';

/**
 * Dev/demo provider — no real telephony, no vendor account needed.
 * `initiateMaskedCall` returns immediately; `simulateMockProgress` then fires
 * a scripted event sequence through the *same* `applyCallEvent` handler a
 * real provider's webhook would hit — so the whole pipeline (state machine,
 * idempotent dedupe, DB writes, status polling) is exercised for real. Only
 * the phone call itself is fake.
 *
 * Swap to a real vendor by adding `exotel.ts` / `tata.ts` implementing the
 * same `CallProvider` interface and registering it in `index.ts` — nothing
 * in calls.service, the routes, or the frontend needs to change.
 */
export const mockProvider: CallProvider = {
  name: 'mock',

  async initiateMaskedCall(p: InitiateMaskedCallParams): Promise<InitiateMaskedCallResult> {
    return {
      providerCallId: `mock_${crypto.randomUUID()}`,
      status: 'INITIATED',
      raw: { ...p, simulated: true },
    };
  },

  parseWebhook(body: unknown): NormalizedCallEvent {
    // The mock never receives a real HTTP webhook (see simulateMockProgress)
    // — this only exists so CallProvider stays a uniform interface.
    return body as NormalizedCallEvent;
  },
};

/**
 * Scripted lifecycle for a mock call: caller answers, owner picks up, talks
 * briefly, hangs up. Each step is delayed and routed through `onEvent`
 * (calls.service's `applyCallEvent`), mirroring how real webhooks arrive
 * asynchronously over the life of a call.
 */
export const simulateMockProgress = (
  providerCallId: string,
  onEvent: (evt: NormalizedCallEvent) => Promise<void>,
): void => {
  const steps: { delayMs: number; evt: NormalizedCallEvent }[] = [
    { delayMs: 800,   evt: { providerCallId, status: 'RINGING_CALLER',  raw: { simulated: true } } },
    { delayMs: 2200,  evt: { providerCallId, status: 'CALLER_ANSWERED', raw: { simulated: true } } },
    { delayMs: 3000,  evt: { providerCallId, status: 'RINGING_OWNER',   raw: { simulated: true } } },
    { delayMs: 5000,  evt: { providerCallId, status: 'BRIDGED',         raw: { simulated: true } } },
    { delayMs: 12000, evt: { providerCallId, status: 'COMPLETED', durationSec: 7, raw: { simulated: true } } },
  ];
  for (const { delayMs, evt } of steps) {
    setTimeout(() => { onEvent(evt).catch(() => undefined); }, delayMs);
  }
};
