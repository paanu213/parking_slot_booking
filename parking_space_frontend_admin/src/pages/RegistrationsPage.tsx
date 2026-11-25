import { Fragment, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Pagination, usePage, ADMIN_PAGE_SIZE, type PageInfo } from '@/components/Pagination';
import { CheckCircle2, ClipboardList, Plus, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OrderSourceBadge, OrderTypeSelect, OrderPhones, paymentLabel } from '@/components/OrderStickerQr';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { QrFilterBar, EMPTY_QR_FILTERS, VehicleTypeBadge, EmergencyBlock, qrFilterParams, useDebounced, type QrFilters, type EmergencyInfo } from '@/components/QrFilters';
import { QrVehicleEditDrawer } from '@/components/QrVehicleEditDrawer';
import { statusCls, fmtDateTime, ORDER_STATUS_LABEL, type QrOrderStatus } from '@/lib/qrCallingFormat';

interface RegistrationRow {
  id: string; status: QrOrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; paidAt: string | null; paymentRef: string | null;
  stickerPricePaise: number; monthlyPricePaise: number;
  plate: string | null; vehicleType: 'CAR' | 'BIKE' | null; registrationId: string | null; emergency: EmergencyInfo | null;
  source?: 'WEBSITE' | 'ADMIN'; channel?: string | null; paymentMode?: 'ONLINE' | 'OFFLINE' | 'COMPLIMENTARY';
  scanPhone?: string | null;
  ownerName: string; ownerEmail: string; ownerPhone: string | null;
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
  const location = useLocation();
  const navigate = useNavigate();
  const createdOrderId = (location.state as { createdOrderId?: string } | null)?.createdOrderId;
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [orderType, setOrderType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<QrFilters>(EMPTY_QR_FILTERS);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const qc = useQueryClient();
  const dq = useDebounced(filters.q);

  const [page, setPage] = usePage([tab, orderType, dq, filters.vehicleType, filters.state, filters.city]);
  const { data, isLoading, isFetching } = useQuery<{ items: RegistrationRow[] } & PageInfo>({
    queryKey: ['admin-qr-registrations', tab, orderType, dq, filters.vehicleType, filters.state, filters.city, page],
    queryFn: async () => (await api.get('/admin/qr/orders', { params: { page, pageSize: ADMIN_PAGE_SIZE, paymentStatus: tab === 'ALL' ? undefined : tab, channel: orderType || undefined, ...qrFilterParams({ ...filters, q: dq }, 'q') } })).data,
    placeholderData: keepPreviousData,
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
          <p className="mt-1 text-sm text-slate-500">Every sticker request: paid, awaiting payment, or failed.</p>
        </div>
        <Link to="/sticker-orders/new" className="btn-primary ml-auto gap-1.5">
          <Plus className="h-4 w-4" /> New order
        </Link>
      </div>

      {createdOrderId && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Order created and waiting for the customer to pay online from their account.
          <button type="button" onClick={() => navigate('.', { replace: true, state: null })} className="ml-auto rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/20" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-2">
        <QrFilterBar value={filters} onChange={setFilters} />
        <OrderTypeSelect value={orderType} onChange={setOrderType} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Plate</th><th>Type</th><th>Requested by</th><th>Price</th><th>Payment</th><th>Fulfilment</th><th>Requested</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">No registrations match.</td></tr>
            ) : (
              items.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : o.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="font-mono font-semibold">{o.plate ?? '-'}</td>
                      <td><VehicleTypeBadge type={o.vehicleType} /></td>
                      <td>
                        <p className="font-medium">{o.ownerName}</p>
                        <OrderSourceBadge source={o.source} channel={o.channel} />
                        <p className="text-xs text-slate-400">{o.ownerEmail}</p>
                        {o.ownerPhone
                          ? <p className="text-xs text-slate-500">Account: <a href={`tel:${o.ownerPhone}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline">{o.ownerPhone}</a></p>
                          : <p className="text-xs text-slate-400">No account mobile</p>}
                      </td>
                      <td>
                        {o.monthlyPricePaise > 0
                          ? `₹${(o.stickerPricePaise / 100).toFixed(0)} + ₹${(o.monthlyPricePaise / 100).toFixed(0)}/mo`
                          : `₹${(o.stickerPricePaise / 100).toFixed(0)} one-time`}
                      </td>
                      <td>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.paymentStatus))}>{paymentLabel(o.paymentStatus, o.paymentMode)}</span>
                        {o.paymentRef && <span className="block text-[11px] text-slate-400">{o.paymentRef}</span>}
                      </td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.status))}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                      <td className="text-xs text-slate-400">{fmtDateTime(o.createdAt)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={7} className="space-y-3 px-3 py-3 text-sm">
                          <div>
                            <div className="mb-3"><OrderPhones accountPhone={o.ownerPhone} scanPhone={o.scanPhone ?? null} deliveryPhone={o.shippingPhone} deliveryName={o.shippingName} /></div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliver to</p>
                            <p className="font-semibold">{o.shippingName}</p>
                            <p className="text-slate-500 dark:text-slate-400">{o.addressLine}, {o.city}, {o.state}, {o.pincode}</p>
                            {o.note && <p className="mt-1 text-xs text-slate-400">Note: {o.note}</p>}
                          </div>
                          <EmergencyBlock info={o.emergency} />
                          {o.registrationId && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setEditingVehicle(o.registrationId); }} className="btn-ghost text-xs">
                              Edit customer &amp; emergency details
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination info={data} onPage={setPage} isFetching={isFetching} noun="orders" />
      </div>

      {editingVehicle && (
        <QrVehicleEditDrawer
          vehicleId={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-qr-registrations'] })}
        />
      )}
    </section>
  );
}
