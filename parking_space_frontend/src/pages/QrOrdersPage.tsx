import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, IndianRupee, Link2, Loader2, PackageX, QrCode, RefreshCw, Truck, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inr } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/store/auth';
import { useQrPaymentCheckout } from '@/hooks/useQrPaymentCheckout';

type QrOrderStatus = 'PENDING' | 'CONFIRMED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

interface QrOrder {
  id: string;
  plate: string | null;
  status: QrOrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  paidAt: string | null;
  paymentRef: string | null;
  paymentMode?: 'ONLINE' | 'OFFLINE' | 'COMPLIMENTARY';
  stickerPricePaise: number;
  monthlyPricePaise: number;
  shippingName: string;
  shippingPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  qrLinked: boolean;
  createdAt: string;
}

interface QrOrderStatusEvent {
  id: string;
  status: QrOrderStatus;
  note: string | null;
  createdAt: string;
}

interface PaymentAttempt {
  id: string;
  provider: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  amount: string; // Decimal, serialized as a string
  currency: string;
  failureCode: string | null;
  failureReason: string | null;
  providerPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

const FULFILMENT: Record<QrOrderStatus, { label: string; cls: string }> = {
  PENDING:          { label: 'Awaiting payment',            cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  CONFIRMED:        { label: 'Order confirmed, yet to dispatch', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200' },
  PICKED_UP:        { label: 'Picked up for dispatch',      cls: 'bg-brand-100 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery',             cls: 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200' },
  DELIVERED:        { label: 'Delivered',                    cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200' },
  RETURNED:         { label: 'Returned, resending soon',    cls: 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200' },
  CANCELLED:        { label: 'Cancelled',                    cls: 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200' },
};

const ATTEMPT_STATUS: Record<PaymentAttempt['status'], { label: string; cls: string }> = {
  CREATED:  { label: 'Started, not completed', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  PAID:     { label: 'Paid', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  FAILED:   { label: 'Failed', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' },
  REFUNDED: { label: 'Refunded', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const PaymentHistory = ({ orderId }: { orderId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['qr-order-payments', orderId],
    queryFn: async () => (await api.get<{ items: PaymentAttempt[] }>(`/customer/me/qr-orders/${orderId}/payments`)).data,
  });
  const items = data?.items ?? [];

  if (isLoading) return <Skeleton className="mt-2 h-16 w-full" />;
  if (items.length === 0) return <p className="mt-2 text-xs text-slate-400">No payment attempts yet.</p>;

  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((a) => {
        const s = ATTEMPT_STATUS[a.status];
        return (
          <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50">
            <div>
              <span className={`rounded-full px-1.5 py-0.5 font-semibold ${s.cls}`}>{s.label}</span>
              {a.provider === 'offline' && <span className="ml-1.5 text-slate-500 dark:text-slate-400">Offline payment</span>}
              {a.failureReason && <p className="mt-1 text-slate-500 dark:text-slate-400">{a.failureReason}</p>}
              {a.providerPaymentId && <p className="mt-0.5 font-mono text-[10px] text-slate-400">{a.providerPaymentId}</p>}
            </div>
            <div className="shrink-0 text-right text-slate-400">
              <p>{inr(Number(a.amount))}</p>
              <p>{fmtDateTime(a.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const DeliveryTimeline = ({ orderId }: { orderId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['qr-order-events', orderId],
    queryFn: async () => (await api.get<{ items: QrOrderStatusEvent[] }>(`/customer/me/qr-orders/${orderId}/events`)).data,
  });
  const items = data?.items ?? [];

  if (isLoading) return <Skeleton className="mt-2 h-16 w-full" />;
  if (items.length === 0) return <p className="mt-2 text-xs text-slate-400">No updates yet.</p>;

  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((e) => {
        const f = FULFILMENT[e.status];
        return (
          <li key={e.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50">
            <div>
              <span className={`rounded-full px-1.5 py-0.5 font-semibold ${f.cls}`}>{f.label}</span>
              {e.note && <p className="mt-1 text-slate-500 dark:text-slate-400">{e.note}</p>}
            </div>
            <div className="shrink-0 text-right text-slate-400">{fmtDateTime(e.createdAt)}</div>
          </li>
        );
      })}
    </ul>
  );
};

export const QrOrdersPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['my-qr-orders'],
    queryFn: async () => (await api.get<{ items: QrOrder[] }>('/customer/me/qr-orders')).data,
  });

  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [timelineOpenFor, setTimelineOpenFor] = useState<string | null>(null);
  const { checkingOutId, paymentError, setPaymentError, startCheckout } = useQrPaymentCheckout((orderId) => {
    qc.invalidateQueries({ queryKey: ['my-qr-orders'] });
    qc.invalidateQueries({ queryKey: ['qr-order-payments', orderId] });
  });

  const retry = (o: QrOrder) => {
    setPaymentError(null);
    startCheckout(o.id, { name: o.shippingName, contact: o.shippingPhone, email: user?.email }).then(() => {
      qc.invalidateQueries({ queryKey: ['qr-order-payments', o.id] });
    });
  };

  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold">My QR sticker orders</h1>
        <p className="mt-1 text-sm text-slate-500">Order status, delivery, and payment history.</p>
      </header>

      {paymentError && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Payment didn't go through</p>
            <p className="mt-0.5 text-sm text-rose-600 dark:text-rose-300/90">{paymentError.message}</p>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : isError ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {errorMessage(error)}
          </p>
        ) : items.length === 0 ? (
          <div className="card p-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <PackageX className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold">No orders yet</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Order a QR sticker to let anyone reach you with a masked call.
            </p>
            <Link to="/qr-calling" className="btn-primary mt-5 gap-1.5">
              <QrCode className="h-4 w-4" /> Get your QR sticker
            </Link>
          </div>
        ) : (
          items.map((o) => {
            const f = FULFILMENT[o.status];
            const total = (o.stickerPricePaise + o.monthlyPricePaise) / 100;
            const historyOpen = historyOpenFor === o.id;
            const timelineOpen = timelineOpenFor === o.id;
            return (
              <div key={o.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {o.plate ? (
                      <span className="rounded-lg border-2 border-slate-800 bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">
                        {o.plate}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <QrCode className="h-4 w-4 text-brand-600" /> QR sticker
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.cls}`}>{f.label}</span>
                    {o.qrLinked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        <Link2 className="h-3 w-3" /> QR linked
                      </span>
                    ) : o.status !== 'CANCELLED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <QrCode className="h-3 w-3" /> Not configured yet
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">Ordered {fmtDate(o.createdAt)}</span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Truck className="h-3.5 w-3.5 text-slate-400" />
                  {o.shippingName} · {o.addressLine}, {o.city}, {o.state}, {o.pincode}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="text-sm">
                    <p className="font-semibold">{o.paymentMode === 'COMPLIMENTARY' ? 'Complimentary' : inr(total)}</p>
                    <p className="text-xs text-slate-400">
                      {o.monthlyPricePaise > 0
                        ? `${inr(o.stickerPricePaise / 100)} sticker + ${inr(o.monthlyPricePaise / 100)} first month · then ${inr(o.monthlyPricePaise / 100)}/mo`
                        : 'One-time payment, valid for 10 years'}
                    </p>
                  </div>

                  {o.paymentStatus === 'PAID' ? (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> {o.paymentMode === 'COMPLIMENTARY' ? 'Free' : 'Paid'}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {o.paymentMode === 'OFFLINE' ? 'Paid offline · ' : ''}{o.paidAt ? fmtDate(o.paidAt) : ''}{o.paymentMode === 'ONLINE' && o.paymentRef ? ` · ${o.paymentRef}` : ''}
                      </p>
                    </div>
                  ) : o.status === 'CANCELLED' ? (
                    <span className="text-xs text-slate-400">-</span>
                  ) : (
                    <div className="text-right">
                      {o.paymentStatus === 'FAILED' && (
                        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                          <XCircle className="h-3 w-3" /> Payment failed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => retry(o)}
                        disabled={checkingOutId === o.id}
                        className="btn-primary block gap-1.5 text-sm"
                      >
                        {checkingOutId === o.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : o.paymentStatus === 'FAILED' ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <IndianRupee className="h-4 w-4" />
                        )}
                        {o.paymentStatus === 'FAILED' ? 'Try again' : 'Complete payment'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setTimelineOpenFor(timelineOpen ? null : o.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${timelineOpen ? 'rotate-180' : ''}`} />
                    Delivery status
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryOpenFor(historyOpen ? null : o.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                    Payment log
                  </button>
                </div>
                {timelineOpen && <DeliveryTimeline orderId={o.id} />}
                {historyOpen && <PaymentHistory orderId={o.id} />}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
};
