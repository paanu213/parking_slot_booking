/**
 * The payment seam — mirrors lib/callProviders. Both the real Razorpay
 * gateway and the demo gateway implement this same interface, so swapping
 * one for the other (env vars only, see index.ts) is not a code change
 * anywhere that calls getGateway().
 */

export interface CreateGatewayOrderParams {
  amountPaise: number;
  currency: string;
  /** Our own id (e.g. the QrOrder id) — becomes the gateway's `receipt`. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateGatewayOrderResult {
  providerOrderId: string;
  amount: number; // paise, as echoed back by the gateway
  currency: string;
}

export interface SignatureVerifyParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export type NormalizedPaymentStatus = 'PAID' | 'FAILED' | 'IGNORED';

export interface NormalizedPaymentEvent {
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: NormalizedPaymentStatus;
  amount: number | null; // paise
  currency: string | null;
  failureCode?: string;
  failureReason?: string;
  raw: unknown;
}

export interface FetchedPayment {
  status: string;
  amountPaise: number;
  currency: string;
}

export interface PaymentGateway {
  name: string;
  /** Public key id the frontend checkout widget needs — '' when there's none (demo mode). */
  publicKeyId: string;
  createOrder(p: CreateGatewayOrderParams): Promise<CreateGatewayOrderResult>;
  /** Client-supplied proof after checkout — cryptographic, never trust a bare "success" flag instead of this. */
  verifySignature(p: SignatureVerifyParams): boolean;
  /** Defense-in-depth server-to-server cross-check after signature verification (real gateway only). */
  fetchPayment?(paymentId: string): Promise<FetchedPayment | null>;
  /** Verifies a webhook POST's signature over the exact raw request bytes. */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  /** Only call after verifyWebhookSignature has passed. */
  parseWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent;
}
