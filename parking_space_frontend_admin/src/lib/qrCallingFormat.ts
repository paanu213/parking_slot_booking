// Shared formatting helpers for the QR Calling admin pages
// (QrCallingPage.tsx + QrVehicleDetailPage.tsx + RegistrationsPage.tsx) —
// kept in one place so they don't drift.

export type QrOrderStatus = 'PENDING' | 'CONFIRMED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';

// CONFIRMED is reached automatically the instant payment succeeds (see
// backend qrOrders.service.confirmOnPaymentOps) — admin only drives the
// physical pickup -> dispatch -> delivery stages, plus the RETURNED ->
// CONFIRMED "resend" loop, which restarts pickup/dispatch/delivery fresh.
export const ORDER_STATUS_LABEL: Record<QrOrderStatus, string> = {
  PENDING:           'Awaiting payment',
  CONFIRMED:         'Order confirmed, yet to dispatch',
  PICKED_UP:         'Picked up from store',
  OUT_FOR_DELIVERY:  'Out for delivery',
  DELIVERED:         'Delivered',
  RETURNED:          'Returned',
  CANCELLED:         'Cancelled',
};

const STATUS_CLS: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PAUSED:    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  BRIDGED:   'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PICKED_UP: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  RETURNED:  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CONFIRMED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PENDING:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  PAID:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  FAILED:    'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  REFUNDED:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};
export const statusCls = (s: string) => STATUS_CLS[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const errMsg = (e: unknown, fallback: string) =>
  (e as any)?.response?.data?.error?.message ?? fallback;
