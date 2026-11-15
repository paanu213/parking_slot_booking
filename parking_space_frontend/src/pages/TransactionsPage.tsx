import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Car, CheckCircle2, Clock, MapPin, Receipt, RotateCcw, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inr } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';

type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
type ServiceType = 'SPACE_BOOKING' | 'QR_CODE_REGISTRATION' | 'OTHER';

interface BookingDetail {
  id: string;
  reference: string;
  status: string;
  bookingType: string;
  startAt: string;
  endAt: string;
  slotCode: string;
  vehicleType: string;
  locationName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
}

interface QrOrderDetail {
  id: string;
  status: string;
  plateNumber: string | null;
  shippingName: string;
  city: string;
  state: string;
}

interface Transaction {
  id: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerPaymentId: string | null;
  failureReason: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  createdAt: string;
  serviceType: ServiceType;
  booking?: BookingDetail;
  qrOrder?: QrOrderDetail;
}

const STATUS: Record<PaymentStatus, { label: string; cls: string }> = {
  CREATED:  { label: 'Started, not completed', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  PAID:     { label: 'Paid', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  FAILED:   { label: 'Failed', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' },
  REFUNDED: { label: 'Refunded', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
};

const SERVICE: Record<ServiceType, { label: string; icon: typeof MapPin; cls: string }> = {
  SPACE_BOOKING:         { label: 'Space booking', icon: MapPin, cls: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200' },
  QR_CODE_REGISTRATION:  { label: 'QR sticker',    icon: Car,    cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200' },
  OTHER:                 { label: 'Other',         icon: Receipt, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
};

const FILTERS: { key: 'ALL' | ServiceType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SPACE_BOOKING', label: 'Space bookings' },
  { key: 'QR_CODE_REGISTRATION', label: 'QR sticker orders' },
];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const TransactionsPage = () => {
  const [filter, setFilter] = useState<'ALL' | ServiceType>('ALL');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-transactions'],
    queryFn: async () => (await api.get<{ items: Transaction[] }>('/customer/me/transactions')).data,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(
    () => (filter === 'ALL' ? items : items.filter((t) => t.serviceType === filter)),
    [items, filter],
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">Every payment you've made, across all services, in one place.</p>
      </header>

      {!isLoading && !isError && items.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {f.label} · {f.key === 'ALL' ? items.length : items.filter((t) => t.serviceType === f.key).length}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : isError ? (
          <div className="card p-6 text-center text-sm">
            <p className="text-rose-600 dark:text-rose-400">Couldn't load your transactions.</p>
            <p className="mt-1 text-xs text-slate-500">{errorMessage(error)}</p>
            <button className="btn-ghost mt-4 border border-slate-200 dark:border-slate-700" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Receipt className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold">
              {items.length === 0 ? 'No transactions yet' : 'Nothing here'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {items.length === 0
                ? 'Payments for QR stickers and space bookings will show up here.'
                : 'No transactions match this filter.'}
            </p>
          </div>
        ) : (
          filtered.map((t) => <TransactionRow key={t.id} t={t} />)
        )}
      </div>
    </main>
  );
};

const TransactionRow = ({ t }: { t: Transaction }) => {
  const status = STATUS[t.status];
  const service = SERVICE[t.serviceType];
  const ServiceIcon = service.icon;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${service.cls}`}>
            <ServiceIcon className="h-3 w-3" /> {service.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </div>
        <span className="text-xs text-slate-400">{fmtDateTime(t.createdAt)}</span>
      </div>

      {t.serviceType === 'SPACE_BOOKING' && t.booking && (
        <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {t.booking.locationName}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.booking.addressLine}, {t.booking.city}, {t.booking.state} — {t.booking.pincode}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Slot {t.booking.slotCode} · {t.booking.vehicleType}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDateTime(t.booking.startAt)} → {fmtDateTime(t.booking.endAt)}
            </span>
          </div>
          <p className="text-xs text-slate-400">Booking ref {t.booking.reference} · {t.booking.status}</p>
        </div>
      )}

      {t.serviceType === 'QR_CODE_REGISTRATION' && t.qrOrder && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          {t.qrOrder.plateNumber && (
            <span className="rounded-lg border-2 border-slate-800 bg-white px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">
              {t.qrOrder.plateNumber}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t.qrOrder.shippingName} · {t.qrOrder.city}, {t.qrOrder.state} · Order {t.qrOrder.status}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="text-sm">
          <p className="font-semibold">{inr(t.amount)}</p>
          {t.providerPaymentId && <p className="font-mono text-[11px] text-slate-400">{t.providerPaymentId}</p>}
        </div>

        {t.status === 'FAILED' && t.failureReason && (
          <span className="inline-flex items-start gap-1 text-right text-xs text-rose-600 dark:text-rose-300">
            <XCircle className="mt-0.5 h-3 w-3 shrink-0" /> {t.failureReason}
          </span>
        )}
        {t.status === 'REFUNDED' && t.refundAmount != null && (
          <span className="inline-flex items-center gap-1 text-right text-xs text-amber-700 dark:text-amber-300">
            <RotateCcw className="h-3 w-3" /> {inr(t.refundAmount)} refunded
            {t.refundedAt ? ` · ${fmtDate(t.refundedAt)}` : ''}
          </span>
        )}
        {t.status === 'PAID' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        )}
      </div>
    </div>
  );
};
