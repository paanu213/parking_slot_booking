import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, FileText, IndianRupee, MapPin, Package, PackageX, Pencil, QrCode, Repeat, RotateCcw, Truck, UserCog } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { statusCls, fmtDateTime, errMsg, ORDER_STATUS_LABEL, type QrOrderStatus } from '@/lib/qrCallingFormat';
import { ModalShell } from '@/components/VehicleActionsMenu';
import { KebabMenu, MenuItem, MenuDivider } from '@/components/KebabMenu';
import { QrVehicleEditDrawer } from '@/components/QrVehicleEditDrawer';
import { StickerQrPanel, FulfilmentSummary, ReplacementModal, downloadOrderStickerPdf, type OrderFulfilment } from '@/components/OrderStickerQr';
import { digits10, isPhone10, phoneInputProps } from '@/lib/phone';
import { QrFilterBar, EMPTY_QR_FILTERS, VehicleTypeBadge, EmergencyBlock, qrFilterParams, useDebounced, type QrFilters, type EmergencyInfo } from '@/components/QrFilters';


interface OrderRow {
  id: string; status: QrOrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; paidAt: string | null; paymentRef: string | null;
  stickerPricePaise: number; monthlyPricePaise: number;
  plate: string | null; vehicleType: 'CAR' | 'BIKE' | null; registrationId: string | null; emergency: EmergencyInfo | null;
  ownerName: string; ownerEmail: string; ownerPhone: string | null;
  shippingName: string; shippingPhone: string; addressLine: string;
  city: string; state: string; pincode: string; note: string | null;
  confirmedAt: string | null; pickedUpAt: string | null; outForDeliveryAt: string | null;
  deliveredAt: string | null; returnedAt: string | null; deliveryAttempt: number;
  qrConfigured: boolean; qrToken: string | null; qrConfiguredAt: string | null;
  dispatchedStickerToken: string | null; dispatchedAt: string | null;
  stickerToken: string | null; stickerUrl: string | null; fulfilment: OrderFulfilment;
  createdAt: string;
}

interface OrderStatusEvent {
  id: string; status: QrOrderStatus; note: string | null; createdAt: string;
  actor: { fullName: string; email: string } | null;
}

// CONFIRMED is reached automatically the instant payment succeeds (see
// backend qrOrders.service.confirmOnPaymentOps) — admin only drives the
// physical pickup -> dispatch -> delivery stages, plus the RETURNED ->
// CONFIRMED "resend" loop, which restarts pickup/dispatch/delivery fresh.
const ORDER_NEXT_ACTION: Partial<Record<QrOrderStatus, { next: QrOrderStatus; label: string; icon: typeof Package }>> = {
  CONFIRMED:        { next: 'PICKED_UP',        label: 'Mark picked up from store', icon: Package },
  PICKED_UP:        { next: 'OUT_FOR_DELIVERY', label: 'Mark out for delivery',     icon: Truck },
  OUT_FOR_DELIVERY: { next: 'DELIVERED',         label: 'Mark delivered',           icon: CheckCircle2 },
  RETURNED:         { next: 'CONFIRMED',         label: 'Send again',               icon: RotateCcw },
};

const ORDER_RETURNABLE_FROM: QrOrderStatus[] = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const ORDER_CANCELLABLE_FROM: QrOrderStatus[] = ['PENDING', 'CONFIRMED'];

const OrderTimeline = ({ orderId }: { orderId: string }) => {
  const { data, isLoading } = useQuery<{ items: OrderStatusEvent[] }>({
    queryKey: ['admin-qr-order-events', orderId],
    queryFn: async () => (await api.get(`/admin/qr/orders/${orderId}/events`)).data,
  });
  const items = data?.items ?? [];

  if (isLoading) return <p className="mt-3 text-xs text-slate-400">Loading timeline…</p>;
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 dark:border-slate-700">
      {items.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 font-semibold', statusCls(e.status))}>{ORDER_STATUS_LABEL[e.status]}</span>
          <span className="text-slate-400">
            {fmtDateTime(e.createdAt)}{e.actor ? ` · ${e.actor.fullName}` : ''}
          </span>
          {e.note && <span className="text-slate-500 dark:text-slate-400">— {e.note}</span>}
        </li>
      ))}
    </ul>
  );
};

const ReturnReasonModal = ({
  orderId, onClose, onDone,
}: { orderId: string; onClose: () => void; onDone: () => void }) => {
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/qr/orders/${orderId}/status`, { status: 'RETURNED', note: note.trim() || undefined }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <ModalShell
      title="Mark sticker returned"
      subtitle="Damaged, undeliverable, or sent back by the customer — record why. You can resend once it's ready to go out again."
      onClose={onClose}
    >
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (optional)"
        rows={3}
        className="input mt-3 w-full resize-none"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not update')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Saving…' : 'Mark returned'}
      </button>
    </ModalShell>
  );
};

const RefundModal = ({
  order, onClose, onDone,
}: { order: OrderRow; onClose: () => void; onDone: () => void }) => {
  const maxRefund = (order.stickerPricePaise + order.monthlyPricePaise) / 100;
  const [amount, setAmount] = useState(String(maxRefund));
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => api.post(`/admin/qr/orders/${order.id}/refund`, { amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <ModalShell
      title="Refund this order"
      subtitle="Sends the order to Cancelled and records the refund against the original payment — the same trail shown in Payments and Registrations."
      onClose={onClose}
    >
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Refund amount (₹)</label>
          <input
            autoFocus
            type="number"
            min="1"
            max={maxRefund}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input w-full"
          />
          <p className="mt-1 text-[11px] text-slate-400">Order total: ₹{maxRefund.toFixed(2)}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Reason / note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Customer cancelled before dispatch"
            rows={2}
            className="input w-full resize-none"
          />
        </div>
      </div>
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not process refund')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !amount || Number(amount) <= 0 || Number(amount) > maxRefund}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Processing…' : `Refund ₹${amount || '0'}`}
      </button>
    </ModalShell>
  );
};

const EditShippingModal = ({
  order, onClose, onDone,
}: { order: OrderRow; onClose: () => void; onDone: () => void }) => {
  const [f, setF] = useState({
    shippingName: order.shippingName, shippingPhone: digits10(order.shippingPhone), addressLine: order.addressLine,
    city: order.city, state: order.state, pincode: order.pincode, note: order.note ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/qr/orders/${order.id}/details`, { ...f, note: f.note.trim() || null }),
    onSuccess: () => { onDone(); onClose(); },
  });
  const valid = f.shippingName.trim().length >= 2 && isPhone10(f.shippingPhone) && f.addressLine.trim().length >= 5
    && f.city.trim().length >= 2 && f.state.trim().length >= 2 && /^[0-9]{4,10}$/.test(f.pincode.trim());

  return (
    <ModalShell title="Edit shipping details" subtitle="Correct the delivery name, phone or address for this order." onClose={onClose}>
      <div className="mt-3 space-y-2">
        <input className="input w-full" placeholder="Name" value={f.shippingName} onChange={(e) => set('shippingName', e.target.value)} />
        <input {...phoneInputProps} className="input w-full" placeholder="10-digit mobile" value={f.shippingPhone} onChange={(e) => set('shippingPhone', digits10(e.target.value))} />
        <textarea rows={2} className="input w-full resize-none" placeholder="Address" value={f.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="City" value={f.city} onChange={(e) => set('city', e.target.value)} />
          <input className="input" placeholder="State" value={f.state} onChange={(e) => set('state', e.target.value)} />
        </div>
        <input className="input w-full" placeholder="Pincode" inputMode="numeric" maxLength={10} value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} />
        <input className="input w-full" placeholder="Note (optional)" value={f.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not update')}</p>}
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !valid} className="btn-primary mt-4 w-full justify-center">
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </ModalShell>
  );
};

const DispatchStickerModal = ({
  order, onClose, onDone,
}: { order: OrderRow; onClose: () => void; onDone: () => void }) => {
  const [token, setToken] = useState(order.dispatchedStickerToken ?? '');

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/qr/orders/${order.id}/dispatch-sticker`, { token: token.trim() }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <ModalShell
      title="Record dispatched sticker"
      subtitle="Enter the unique code printed on the physical sticker going into this package, so it's traceable to this order."
      onClose={onClose}
    >
      <input
        autoFocus
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="e.g. a1b2c3d4"
        className="input mt-3 w-full font-mono"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not record this sticker — check the code is correct.')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !token.trim()}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </ModalShell>
  );
};

/**
 * All fulfilment status changes go through this one menu — same transitions,
 * same PATCH /admin/qr/orders/:id/status call, wherever it's opened from, so
 * status stays consistent across the app rather than drifting per-page.
 */
const StickerOrderActionsMenu = ({
  order, isPending, onSetStatus, onMarkReturned, onRefund, onDispatchSticker, onEditShipping, onEditCustomer, onReplacement,
}: {
  order: OrderRow;
  isPending: boolean;
  onSetStatus: (next: QrOrderStatus) => void;
  onMarkReturned: () => void;
  onRefund: () => void;
  onDispatchSticker: () => void;
  onEditShipping: () => void;
  onEditCustomer: () => void;
  onReplacement: () => void;
}) => {
  const nextAction = ORDER_NEXT_ACTION[order.status];
  const canReturn = ORDER_RETURNABLE_FROM.includes(order.status);
  const canCancel = ORDER_CANCELLABLE_FROM.includes(order.status);
  // Refund is a money action, independent of fulfilment stage — available on
  // any paid order that hasn't already been refunded, whatever stage it's at.
  const canRefund = order.paymentStatus === 'PAID';
  const hasFulfilmentActions = !!nextAction || canReturn || canCancel || canRefund;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <KebabMenu>
        {order.registrationId && (
          <MenuItem icon={<UserCog className="h-4 w-4" />} onClick={onEditCustomer}>
            Edit customer details
          </MenuItem>
        )}
        <MenuItem icon={<MapPin className="h-4 w-4" />} onClick={onEditShipping}>
          Edit shipping details
        </MenuItem>
        <MenuDivider />
        <MenuItem icon={<QrCode className="h-4 w-4" />} onClick={onDispatchSticker} disabled={isPending}>
          {order.dispatchedStickerToken ? 'Update dispatched sticker' : 'Record dispatched sticker'}
        </MenuItem>
        {order.stickerToken && (
          <MenuItem icon={<FileText className="h-4 w-4" />} onClick={() => { void downloadOrderStickerPdf(order.id, order.plate ?? order.stickerToken!); }}>
            Download sticker for reprint
          </MenuItem>
        )}
        {order.status === 'DELIVERED' && order.paymentStatus === 'PAID' && order.stickerToken && (
          <MenuItem icon={<Repeat className="h-4 w-4" />} onClick={onReplacement} disabled={isPending}>
            Send replacement sticker (lost / damaged)
          </MenuItem>
        )}
        {hasFulfilmentActions && <MenuDivider />}
        {nextAction && (
          <MenuItem icon={<nextAction.icon className="h-4 w-4" />} onClick={() => onSetStatus(nextAction.next)} disabled={isPending}>
            {nextAction.label}
          </MenuItem>
        )}
        {canReturn && (
          <MenuItem variant="warning" icon={<PackageX className="h-4 w-4" />} onClick={onMarkReturned} disabled={isPending}>
            Mark returned
          </MenuItem>
        )}
        {(canCancel || canRefund) && (nextAction || canReturn) && <MenuDivider />}
        {canCancel && (
          <MenuItem variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => onSetStatus('CANCELLED')} disabled={isPending}>
            Cancel order
          </MenuItem>
        )}
        {canRefund && (
          <MenuItem variant="danger" icon={<IndianRupee className="h-4 w-4" />} onClick={onRefund} disabled={isPending}>
            Refund
          </MenuItem>
        )}
      </KebabMenu>
    </div>
  );
};

/**
 * The fulfilment queue — scoped to paid orders only. An unpaid or failed
 * request has nothing to dispatch; those live in the Registrations page.
 */
export default function StickerOrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<QrFilters>(EMPTY_QR_FILTERS);
  const dq = useDebounced(filters.q);

  // PAID + REFUNDED — everything that ever had money move on it, including
  // returns and refunds, so this stays the one place to see an order's full
  // lifecycle. Never-paid / failed attempts still live in Registrations only.
  const { data, isLoading } = useQuery<{ items: OrderRow[] }>({
    queryKey: ['admin-qr-orders', status, dq, filters.vehicleType, filters.state, filters.city],
    queryFn: async () => (await api.get('/admin/qr/orders', { params: { status: status || undefined, paymentStatus: 'PAID,REFUNDED', ...qrFilterParams({ ...filters, q: dq }, 'q') } })).data,
  });
  const items = data?.items ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-qr-orders'] });
    qc.invalidateQueries({ queryKey: ['admin-qr-order-events'] });
  };

  const setOrderStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: QrOrderStatus }) =>
      api.patch(`/admin/qr/orders/${id}/status`, { status: next }),
    onSuccess: refresh,
  });

  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <Package className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sticker Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pickup, dispatch, delivery, returns, and refunds. See{' '}
            <Link to="/registrations" className="font-semibold text-brand-600 hover:underline">Registrations</Link> for pending or failed requests.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
      <QrFilterBar value={filters} onChange={setFilters} />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-9 w-56 py-0">
        <option value="">All statuses</option>
        {(['CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'] as QrOrderStatus[]).map((s) => (
          <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
        ))}
      </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Plate</th><th>Type</th><th>Requested by</th><th>Price</th><th>Payment</th><th>Fulfilment</th><th>QR code</th><th>Requested</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">No sticker orders match.</td></tr>
            ) : (
              items.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : o.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="font-mono font-semibold">{o.plate ?? '—'}</td>
                      <td><VehicleTypeBadge type={o.vehicleType} /></td>
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
                      <td>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.status))}>{ORDER_STATUS_LABEL[o.status]}</span>
                        {o.deliveryAttempt > 1 && <span className="ml-1.5 text-[11px] text-slate-400">Attempt {o.deliveryAttempt}</span>}
                        <FulfilmentSummary f={o.fulfilment} />
                      </td>
                      <td>
                        {o.qrConfigured ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Configured
                            </span>
                            <p className="mt-1 font-mono text-[11px] text-slate-400">{o.qrToken}</p>
                            {o.qrConfiguredAt && <p className="text-[11px] text-slate-400">{fmtDateTime(o.qrConfiguredAt)}</p>}
                          </>
                        ) : o.dispatchedStickerToken ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                              <QrCode className="h-3 w-3" /> Dispatched
                            </span>
                            <p className="mt-1 font-mono text-[11px] text-slate-400">{o.dispatchedStickerToken}</p>
                            {o.dispatchedAt && <p className="text-[11px] text-slate-400">{fmtDateTime(o.dispatchedAt)} · awaiting customer setup</p>}
                          </>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Not configured
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-slate-400">{fmtDateTime(o.createdAt)}</td>
                      <td className="text-right">
                        <StickerOrderActionsMenu
                          order={o}
                          isPending={setOrderStatus.isPending}
                          onSetStatus={(next) => setOrderStatus.mutate({ id: o.id, next })}
                          onMarkReturned={() => setReturningId(o.id)}
                          onRefund={() => setRefundingId(o.id)}
                          onDispatchSticker={() => setDispatchingId(o.id)}
                          onEditShipping={() => setShippingId(o.id)}
                          onEditCustomer={() => setEditingVehicle(o.registrationId)}
                          onReplacement={() => setReplacingId(o.id)}
                        />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={9} className="px-3 py-3 text-sm">
                          <p className="font-semibold">{o.shippingName} · {o.shippingPhone}</p>
                          <p className="text-slate-500 dark:text-slate-400">{o.addressLine}, {o.city}, {o.state} — {o.pincode}</p>
                          {o.note && <p className="mt-1 text-xs text-slate-400">Note: {o.note}</p>}
                          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                            <StickerQrPanel orderId={o.id} token={o.stickerToken} url={o.stickerUrl} plate={o.plate} />
                          </div>
                          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700"><EmergencyBlock info={o.emergency} /></div>
                          <OrderTimeline orderId={o.id} />
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

      {returningId && (
        <ReturnReasonModal orderId={returningId} onClose={() => setReturningId(null)} onDone={refresh} />
      )}
      {refundingId && (() => {
        const order = items.find((i) => i.id === refundingId);
        return order ? <RefundModal order={order} onClose={() => setRefundingId(null)} onDone={refresh} /> : null;
      })()}
      {replacingId && (() => {
        const order = items.find((i) => i.id === replacingId);
        return order ? <ReplacementModal orderId={order.id} plate={order.plate} onClose={() => setReplacingId(null)} onDone={refresh} /> : null;
      })()}
      {shippingId && (() => {
        const order = items.find((i) => i.id === shippingId);
        return order ? <EditShippingModal order={order} onClose={() => setShippingId(null)} onDone={refresh} /> : null;
      })()}
      {editingVehicle && (
        <QrVehicleEditDrawer vehicleId={editingVehicle} onClose={() => setEditingVehicle(null)} onSaved={refresh} />
      )}
      {dispatchingId && (() => {
        const order = items.find((i) => i.id === dispatchingId);
        return order ? <DispatchStickerModal order={order} onClose={() => setDispatchingId(null)} onDone={refresh} /> : null;
      })()}
    </section>
  );
}
