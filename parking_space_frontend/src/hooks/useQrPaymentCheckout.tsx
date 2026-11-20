import { useState } from 'react';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/errors';

/**
 * Shared Razorpay checkout for anywhere a QR sticker order can be paid for —
 * the initial order wizard (QrCallingLandingPage) and a retry from the
 * orders list (QrOrdersPage) both use this single implementation instead of
 * two copies of the same checkout/verify/fail/cancel wiring.
 */

// ── Razorpay Checkout.js — loaded lazily, only once payment actually starts ──

interface RazorpayFailurePayload {
  error?: { code?: string; description?: string; reason?: string; source?: string; step?: string };
}
interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (resp: RazorpayFailurePayload) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;
const loadRazorpayScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error('Could not load the payment window. Check your connection and try again'));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
};

export interface CheckoutResponse {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
}

export interface PaymentError {
  message: string;
}

export const friendlyPaymentError = (e: unknown): PaymentError => {
  if (e instanceof ApiError) {
    if (e.status === undefined) return { message: 'Network error. Check your connection and try again. Nothing was charged.' };
    if (/already registered by another owner/i.test(e.message)) return { message: 'This plate is already registered to another account.' };
    return { message: e.message };
  }
  return { message: errorMessage(e) };
};

export interface QrCheckoutPrefill {
  name?: string;
  contact?: string;
  email?: string;
}

export const useQrPaymentCheckout = (onPaid: (qrOrderId: string) => void) => {
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);

  const openRazorpayCheckout = (orderId: string, checkout: CheckoutResponse, prefill?: QrCheckoutPrefill) => {
    const rzp = new window.Razorpay!({
      key:         checkout.keyId,
      order_id:    checkout.orderId,
      amount:      checkout.amount,
      currency:    checkout.currency,
      name:        checkout.name,
      description: checkout.description,
      prefill,
      theme:       { color: '#4f46e5' },
      handler: (response) => {
        api.post(`/customer/me/qr-orders/${orderId}/verify`, response)
          .then(() => onPaid(orderId))
          .catch((e) => setPaymentError(friendlyPaymentError(e)));
      },
      modal: {
        ondismiss: () => {
          api.post(`/customer/me/qr-orders/${orderId}/payment-cancelled`, { providerOrderId: checkout.orderId }).catch(() => {});
          setPaymentError({ message: "Payment cancelled, you closed the window before it finished. Nothing was charged." });
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      const err = resp.error ?? {};
      api.post(`/customer/me/qr-orders/${orderId}/payment-failed`, {
        providerOrderId: checkout.orderId, code: err.code, description: err.description, reason: err.reason, source: err.source, step: err.step,
      }).catch(() => {});
      setPaymentError({
        message: err.description || 'The payment failed, often a bank decline or a dropped connection. No amount was charged.',
      });
    });
    rzp.open();
  };

  const startCheckout = async (orderId: string, prefill?: QrCheckoutPrefill) => {
    setPaymentError(null);
    setCheckingOutId(orderId);
    try {
      const { data: checkout } = await api.post<CheckoutResponse>(`/customer/me/qr-orders/${orderId}/checkout`, {});
      await loadRazorpayScript();
      openRazorpayCheckout(orderId, checkout, prefill);
    } catch (e) {
      setPaymentError(friendlyPaymentError(e));
    } finally {
      setCheckingOutId(null);
    }
  };

  return { checkingOutId, paymentError, setPaymentError, startCheckout };
};
