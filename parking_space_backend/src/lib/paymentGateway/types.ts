/**
 * The payment seam — mirrors lib/callProviders. Callers only ever talk to
 * this interface (see index.ts's getGateway()), never to Razorpay's SDK
 * directly.
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

export type NormalizedPaymentStatus = 'PAID' | 'FAILED' | 'REFUNDED' | 'IGNORED';

export interface NormalizedPaymentEvent {
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: NormalizedPaymentStatus;
  amount: number | null; // paise
  currency: string | null;
  failureCode?: string;
  failureReason?: string;
  /** Set only on REFUNDED events. */
  providerRefundId?: string | null;
  raw: unknown;
}

export interface FetchedPayment {
  status: string;
  amountPaise: number;
  currency: string;
}

export interface RefundParams {
  /** The gateway's own payment id (Payment.providerPaymentId) — not our internal Payment.id. */
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}

export interface RefundResult {
  providerRefundId: string;
  /** 'pending' | 'processed' | 'failed' */
  status: string;
}

export interface PaymentGateway {
  name: string;
  /** Public key id the frontend checkout widget needs. */
  publicKeyId: string;
  createOrder(p: CreateGatewayOrderParams): Promise<CreateGatewayOrderResult>;
  /** Client-supplied proof after checkout — cryptographic, never trust a bare "success" flag instead of this. */
  verifySignature(p: SignatureVerifyParams): boolean;
  /** Defense-in-depth server-to-server cross-check after signature verification. */
  fetchPayment?(paymentId: string): Promise<FetchedPayment | null>;
  /** Issues a real refund at the gateway for a captured payment — never mark a Payment REFUNDED in our own DB without this succeeding first. */
  refund(p: RefundParams): Promise<RefundResult>;
  /** Verifies a webhook POST's signature over the exact raw request bytes. */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  /** Only call after verifyWebhookSignature has passed. */
  parseWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent;
}
