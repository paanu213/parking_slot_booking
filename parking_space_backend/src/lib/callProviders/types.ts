/**
 * The telephony seam (blueprint §5) — every real vendor (Exotel, Tata, …)
 * implements this same interface, so swapping or running two providers is an
 * adapter change, not a schema or flow change. `CallSession.provider` records
 * which one handled each call.
 */

export interface InitiateMaskedCallParams {
  callerE164: string;
  ownerE164: string;
  virtualNumber: string;
  sessionId: string;
  whisper?: boolean;
  record?: boolean;
}

export interface InitiateMaskedCallResult {
  providerCallId: string;
  status: string; // provider's own raw status string, for audit — we drive off NormalizedCallEvent, not this
  raw: unknown;
}

export type NormalizedCallStatus =
  | 'RINGING_CALLER' | 'CALLER_ANSWERED' | 'RINGING_OWNER' | 'BRIDGED'
  | 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'OWNER_REJECTED' | 'FAILED';

export interface NormalizedCallEvent {
  providerCallId: string;
  status: NormalizedCallStatus;
  hangupCause?: string;
  durationSec?: number;
  recordingUrl?: string;
  costPaise?: number;
  raw: unknown;
}

export interface CallProvider {
  name: string;
  initiateMaskedCall(p: InitiateMaskedCallParams): Promise<InitiateMaskedCallResult>;
  /** Parse a provider's webhook POST body into our normalized shape. */
  parseWebhook(body: unknown): NormalizedCallEvent;
}
