import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/errors';

/**
 * Shared Razorpay (or demo-gateway) checkout for anywhere a QR sticker order
 * can be paid for — the initial order wizard (QrCallingLandingPage) and a
 * retry from the orders list (QrOrdersPage) both use this single
 * implementation instead of two copies of the same checkout/verify/fail/
 * cancel wiring. See the backend's lib/paymentGateway for the demo-vs-real
 * gateway seam this talks to.
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
      reject(new Error('Could not load the payment window — check your connection and try again'));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
};

export interface CheckoutResponse {
  mode: 'razorpay' | 'demo';
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
    if (e.status === undefined) return { message: 'Network error — check your connection and try again. Nothing was charged.' };
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
  const [demoCheckout, setDemoCheckout] = useState<(CheckoutResponse & { qrOrderId: string }) | null>(null);

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
          setPaymentError({ message: "Payment cancelled — you closed the window before it finished. Nothing was charged." });
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      const err = resp.error ?? {};
      api.post(`/customer/me/qr-orders/${orderId}/payment-failed`, {
        providerOrderId: checkout.orderId, code: err.code, description: err.description, reason: err.reason, source: err.source, step: err.step,
      }).catch(() => {});
      setPaymentError({
        message: err.description || 'The payment failed — often a bank decline or a dropped connection. No amount was charged.',
      });
    });
    rzp.open();
  };

  const startCheckout = async (orderId: string, prefill?: QrCheckoutPrefill) => {
    setPaymentError(null);
    setCheckingOutId(orderId);
    try {
      const { data: checkout } = await api.post<CheckoutResponse>(`/customer/me/qr-orders/${orderId}/checkout`, {});
      if (checkout.mode === 'razorpay') {
        await loadRazorpayScript();
        openRazorpayCheckout(orderId, checkout, prefill);
      } else {
        setDemoCheckout({ ...checkout, qrOrderId: orderId });
      }
    } catch (e) {
      setPaymentError(friendlyPaymentError(e));
    } finally {
      setCheckingOutId(null);
    }
  };

  const demoModal = demoCheckout ? (
    <DemoPaymentModal
      checkout={demoCheckout}
      onDone={() => { setDemoCheckout(null); onPaid(demoCheckout.qrOrderId); }}
      onClose={(err) => { setDemoCheckout(null); setPaymentError(err); }}
    />
  ) : null;

  return { checkingOutId, paymentError, setPaymentError, startCheckout, demoModal };
};

const DemoPaymentModal = ({
  checkout, onDone, onClose,
}: {
  checkout: CheckoutResponse & { qrOrderId: string };
  onDone: () => void;
  onClose: (err: PaymentError) => void;
}) => {
  const [busy, setBusy] = useState<'success' | 'failure' | 'cancel' | null>(null);

  const finish = async (outcome: 'success' | 'failure') => {
    setBusy(outcome);
    try {
      const { data } = await api.post<{ ok: boolean; paid: boolean }>(
        `/customer/me/qr-orders/${checkout.qrOrderId}/demo-complete`,
        { providerOrderId: checkout.orderId, outcome },
      );
      if (outcome === 'success' && data.paid) {
        onDone();
      } else {
        onClose({ message: 'Simulated payment failure (demo mode) — no amount was charged.' });
      }
    } catch (e) {
      onClose(friendlyPaymentError(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    await api.post(`/customer/me/qr-orders/${checkout.qrOrderId}/payment-cancelled`, { providerOrderId: checkout.orderId }).catch(() => {});
    onClose({ message: "Payment cancelled — you closed the window before it finished. Nothing was charged." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <FlaskConical className="h-3.5 w-3.5" /> Demo payment
          </span>
          <button type="button" onClick={cancel} disabled={!!busy} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-center font-display text-3xl font-bold">₹{(checkout.amount / 100).toFixed(0)}</p>
        <p className="text-center text-xs text-slate-400">{checkout.currency} · order {checkout.orderId}</p>

        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          The real payment gateway isn't connected yet — this simulates what Razorpay Checkout would
          do, through the exact same server-side verification a real payment goes through. No money moves.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => finish('success')}
            disabled={!!busy}
            className="btn-primary w-full justify-center gap-2"
          >
            {busy === 'success' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Simulate success
          </button>
          <button
            type="button"
            onClick={() => finish('failure')}
            disabled={!!busy}
            className="btn-ghost w-full justify-center gap-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            {busy === 'failure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Simulate failure
          </button>
        </div>
      </div>
    </div>
  );
};
