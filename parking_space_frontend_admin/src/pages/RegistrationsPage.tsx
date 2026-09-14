import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { statusCls, fmtDateTime, ORDER_STATUS_LABEL, type QrOrderStatus } from '@/lib/qrCallingFormat';

interface RegistrationRow {
  id: string; status: QrOrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; paidAt: string | null; paymentRef: string | null;
  stickerPricePaise: number; monthlyPricePaise: number;
  plate: string | null; ownerName: string; ownerEmail: string; ownerPhone: string | null;
  shippingName: string; shippingPhone: string; addressLine: string;
  city: string; state: string; pincode: string; note: string | null;
  createdAt: string;
}

type FilterTab = 'ALL' | 'PAID' | 'FAILED' | 'REFUNDED';
const TABS: { value: FilterTab; label: string }[] = [
  { value: 'ALL',      label: 'All' },
  { value: 'PAID',     label: 'Successful' },
  { value: 'FAILED',   label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

/**
 * Every "Get your QR sticker" request, whatever happened to its payment —
 * the full funnel (paid, still pending, abandoned/failed). The Sticker
 * orders page (under QR Calling) only shows the paid subset, since that's
 * the operational dispatch queue; this page is for visibility into the
 * whole thing, including requests that never converted.
 */
export default function RegistrationsPage() {
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: RegistrationRow[] }>({
    queryKey: ['admin-qr-registrations', tab],
    queryFn: async () => (await api.get('/admin/qr/orders', { params: { paymentStatus: tab === 'ALL' ? undefined : tab } })).data,
  });
  const items = data?.items ?? [];

  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <ClipboardList className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Registrations</h1>
          <p className="mt-1 text-sm text-slate-500">Every sticker request — paid, awaiting payment, or failed.</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition',
              tab === value
                ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Plate</th><th>Requested by</th><th>Price</th><th>Payment</th><th>Fulfilment</th><th>Requested</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">No registrations in this category.</td></tr>
            ) : (
              items.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : o.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="font-mono font-semibold">{o.plate ?? '—'}</td>
                      <td>
                        <p className="font-medium">{o.ownerName}</p>
                        <p className="text-xs text-slate-400">{o.ownerEmail}</p>
                        <a href={`tel:${o.shippingPhone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-brand-600 hover:underline">{o.shippingPhone}</a>
                      </td>
                      <td>
                        {o.monthlyPricePaise > 0
                          ? `₹${(o.stickerPricePaise / 100).toFixed(0)} + ₹${(o.monthlyPricePaise / 100).toFixed(0)}/mo`
                          : `₹${(o.stickerPricePaise / 100).toFixed(0)} one-time`}
                      </td>
                      <td>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.paymentStatus))}>{o.paymentStatus}</span>
                        {o.paymentRef && <span className="block text-[11px] text-slate-400">{o.paymentRef}</span>}
                      </td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.status))}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                      <td className="text-xs text-slate-400">{fmtDateTime(o.createdAt)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={6} className="px-3 py-3 text-sm">
                          <p className="font-semibold">{o.shippingName} · {o.shippingPhone}</p>
                          <p className="text-slate-500 dark:text-slate-400">{o.addressLine}, {o.city}, {o.state} — {o.pincode}</p>
                          {o.note && <p className="mt-1 text-xs text-slate-400">Note: {o.note}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
