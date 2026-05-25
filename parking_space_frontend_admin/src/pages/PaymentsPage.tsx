import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, Search, TrendingUp, Globe, UserCheck,
  Banknote, Smartphone, CreditCard, Building, X, RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ── Payment method config ─────────────────────────────────────────────────────
const METHOD_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  CASH:        { label: 'Cash',        icon: <Banknote   className="h-3 w-3" />, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
  UPI:         { label: 'UPI',         icon: <Smartphone className="h-3 w-3" />, cls: 'bg-violet-100  text-violet-700  dark:bg-violet-900/20  dark:text-violet-300'  },
  CARD_DEBIT:  { label: 'Debit Card',  icon: <CreditCard className="h-3 w-3" />, cls: 'bg-blue-100    text-blue-700    dark:bg-blue-900/20    dark:text-blue-300'    },
  CARD_CREDIT: { label: 'Credit Card', icon: <CreditCard className="h-3 w-3" />, cls: 'bg-indigo-100  text-indigo-700  dark:bg-indigo-900/20  dark:text-indigo-300'  },
  NETBANKING:  { label: 'Net Banking', icon: <Building   className="h-3 w-3" />, cls: 'bg-amber-100   text-amber-700   dark:bg-amber-900/20   dark:text-amber-300'   },
  WALLET:      { label: 'Wallet',      icon: <Wallet     className="h-3 w-3" />, cls: 'bg-pink-100    text-pink-700    dark:bg-pink-900/20    dark:text-pink-300'    },
  ONLINE:      { label: 'Online',      icon: <Globe      className="h-3 w-3" />, cls: 'bg-blue-100    text-blue-700    dark:bg-blue-900/20    dark:text-blue-300'    },
};

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD_DEBIT', 'CARD_CREDIT', 'NETBANKING', 'WALLET'] as const;

// ── Derived payment status ────────────────────────────────────────────────────
type DerivedStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'PARTIAL_REFUND' | 'FULLY_REFUNDED';

const STATUS_META: Record<DerivedStatus, { label: string; cls: string }> = {
  COMPLETED:      { label: 'Completed',     cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  PENDING:        { label: 'Pending',        cls: 'bg-amber-100   text-amber-800   dark:bg-amber-900/30   dark:text-amber-300'   },
  FAILED:         { label: 'Failed',         cls: 'bg-red-100     text-red-800     dark:bg-red-900/30     dark:text-red-300'     },
  PARTIAL_REFUND: { label: 'Partial Refund', cls: 'bg-orange-100  text-orange-800  dark:bg-orange-900/30  dark:text-orange-300'  },
  FULLY_REFUNDED: { label: 'Fully Refunded', cls: 'bg-blue-100    text-blue-800    dark:bg-blue-900/30    dark:text-blue-300'    },
};

// ── Normalise booking → flat Row ──────────────────────────────────────────────
interface Row {
  id:            string;
  date:          string;
  reference:     string;
  orderId:       string | null;
  isDirect:      boolean;
  customerName:  string;
  customerEmail: string;
  spaceName:     string;
  city:          string;
  vendorId:      string;
  vendorName:    string;
  paymentMethod: string | null;
  amount:        number;
  refundAmount:  number;
  refundNote:    string | null;
  status:        DerivedStatus;
}

function deriveStatus(b: any): DerivedStatus {
  const total   = Number(b.totalAmount ?? 0);
  const payment = b.payments?.[0] ?? null;

  if (b.isDirectBooking) {
    const refund = Number(b.refundAmount ?? 0);
    if (refund > 0 && refund >= total) return 'FULLY_REFUNDED';
    if (refund > 0)                    return 'PARTIAL_REFUND';
    return 'COMPLETED';
  }

  if (!payment) return 'PENDING';
  const pStatus = payment.status as string;
  const refund  = Number(payment.refundAmount ?? 0);
  const paid    = Number(payment.amount ?? 0);

  if (pStatus === 'FAILED') return 'FAILED';
  if (pStatus === 'PAID' || pStatus === 'REFUNDED') {
    if (refund > 0 && refund >= paid) return 'FULLY_REFUNDED';
    if (refund > 0)                   return 'PARTIAL_REFUND';
    return 'COMPLETED';
  }
  return 'PENDING';
}

function normalise(b: any): Row {
  const isDirect = Boolean(b.isDirectBooking);
  const payment  = b.payments?.[0] ?? null;
  return {
    id:            b.id,
    date:          b.createdAt,
    reference:     b.reference ?? '—',
    orderId:       payment?.providerOrderId ?? null,
    isDirect,
    customerName:  isDirect ? (b.guestName  ?? 'Walk-in Guest') : (b.user?.fullName ?? '—'),
    customerEmail: isDirect ? (b.guestPhone ?? '')               : (b.user?.email   ?? ''),
    spaceName:     b.slot?.location?.name               ?? '—',
    city:          b.slot?.location?.city               ?? '',
    vendorId:      b.slot?.location?.vendor?.id         ?? '',
    vendorName:    b.slot?.location?.vendor?.businessName ?? '—',
    paymentMethod: isDirect ? (b.paymentMethod ?? null) : (payment ? 'ONLINE' : null),
    amount:        Number(b.totalAmount ?? 0),
    refundAmount:  isDirect
      ? Number(b.refundAmount   ?? 0)
      : Number(payment?.refundAmount ?? 0),
    refundNote:    isDirect ? (b.refundNote ?? null) : (payment?.refundNote ?? null),
    status:        deriveStatus(b),
  };
}

// ── Refund Modal ──────────────────────────────────────────────────────────────
const RefundModal = ({ row, onClose }: { row: Row; onClose: () => void }) => {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');
  const [err, setErr]       = useState('');

  const refund = useMutation({
    mutationFn: () =>
      api.post(`/admin/bookings/${row.id}/refund`, {
        amount: Number(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payments'] }); onClose(); },
    onError:   (e: any) => setErr(e?.response?.data?.message ?? 'Failed to record refund'),
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const maxRefund = row.amount - row.refundAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Record Refund</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Ref: <span className="font-mono">{row.reference}</span>
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <div><p className="text-xs text-slate-400">Total</p><p className="font-semibold">{inr(row.amount)}</p></div>
          {row.refundAmount > 0 && (
            <div><p className="text-xs text-slate-400">Already Refunded</p><p className="font-semibold text-orange-600">{inr(row.refundAmount)}</p></div>
          )}
          <div><p className="text-xs text-slate-400">Max Refundable</p><p className="font-semibold text-emerald-600">{inr(maxRefund)}</p></div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Refund Amount (₹) <span className="text-red-500">*</span></label>
            <input type="number" min="1" max={maxRefund} step="0.01" className="input w-full"
              placeholder={`Max ${inr(maxRefund)}`} value={amount}
              onChange={(e) => { setAmount(e.target.value); setErr(''); }} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Reason / Note</label>
            <textarea className="input w-full text-sm" rows={2}
              placeholder="e.g. Customer cancelled — full refund"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            disabled={refund.isPending}
            onClick={() => {
              if (!amount || Number(amount) <= 0) { setErr('Enter a valid amount'); return; }
              if (Number(amount) > maxRefund)     { setErr(`Cannot exceed ${inr(maxRefund)}`); return; }
              refund.mutate();
            }}
            className="btn-primary flex-1"
          >
            {refund.isPending ? 'Saving…' : 'Record Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Payment Method Modal ──────────────────────────────────────────────────────
const PaymentMethodModal = ({ row, onClose }: { row: Row; onClose: () => void }) => {
  const qc = useQueryClient();
  const [method, setMethod] = useState(
    (row.paymentMethod && row.paymentMethod !== 'ONLINE') ? row.paymentMethod : 'CASH',
  );

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/admin/bookings/${row.id}/payment-method`, { paymentMethod: method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payments'] }); onClose(); },
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Set Payment Method</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const meta = METHOD_META[m];
            return (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                  method === m
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary flex-1 text-sm">
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// RowMenu is inlined at the call site using KebabMenu from @/components/KebabMenu.

// ── Page ──────────────────────────────────────────────────────────────────────
export const PaymentsPage = () => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | DerivedStatus>('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [search, setSearch]             = useState('');
  const [refundRow, setRefundRow]       = useState<Row | null>(null);
  const [methodRow, setMethodRow]       = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn:  async () => (await api.get('/admin/payments')).data,
  });

  // Load ALL vendors for the dropdown (not just those with payments)
  const { data: vendorsData } = useQuery({
    queryKey: ['admin-vendors-all'],
    queryFn:  async () => (await api.get('/admin/vendors')).data,
  });

  const raw: any[] = data?.items ?? [];
  const rows: Row[] = raw.map(normalise);

  // All vendors from the vendors endpoint, sorted by name
  const vendors: { id: string; name: string }[] = (vendorsData?.items ?? [])
    .map((v: any) => ({ id: v.id, name: v.businessName ?? '—' }))
    .sort((a: { id: string; name: string }, b: { id: string; name: string }) => a.name.localeCompare(b.name));

  // Stats
  const netCollected = rows
    .filter((r) => r.status !== 'PENDING' && r.status !== 'FAILED')
    .reduce((s, r) => s + r.amount - r.refundAmount, 0);
  const totalRefunded = rows.reduce((s, r) => s + r.refundAmount, 0);

  // Apply all filters
  const filtered = rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (vendorFilter !== 'ALL' && r.vendorId !== vendorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        r.customerName.toLowerCase().includes(q)  ||
        r.customerEmail.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q)     ||
        r.spaceName.toLowerCase().includes(q)     ||
        r.vendorName.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  return (
    <>
      <section className="p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Payments</h1>
              <p className="text-sm text-slate-500">
                {rows.filter((r) => !r.isDirect).length} online ·{' '}
                {rows.filter((r) => r.isDirect).length} direct ·{' '}
                {rows.length} total
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Net Collected</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{inr(netCollected)}</p>
              </div>
            </div>
            {totalRefunded > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-800/40 dark:bg-orange-900/20">
                <RotateCcw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="text-[10px] text-orange-600 dark:text-orange-400">Total Refunded</p>
                  <p className="text-base font-bold text-orange-700 dark:text-orange-300">{inr(totalRefunded)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Status tabs ── */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            {(['ALL', 'COMPLETED', 'PENDING', 'PARTIAL_REFUND', 'FULLY_REFUNDED', 'FAILED'] as const).map((s) => {
              const count = s === 'ALL' ? rows.length : rows.filter((r) => r.status === s).length;
              const label = s === 'ALL' ? 'All' : STATUS_META[s].label;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    statusFilter === s
                      ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Secondary filters row ── */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Vendor */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="input text-sm"
          >
            <option value="ALL">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className="input w-full pl-8 text-sm"
              placeholder="Search name, email, space, ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Clear */}
          {(statusFilter !== 'ALL' || vendorFilter !== 'ALL' || search) && (
            <button
              onClick={() => { setStatusFilter('ALL'); setVendorFilter('ALL'); setSearch(''); }}
              className="btn-ghost text-xs text-slate-500"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              {rows.length === 0 ? 'No bookings found.' : 'No payments match this filter.'}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Space · Vendor</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Refund</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const sm = STATUS_META[r.status];
                  const mm = r.paymentMethod ? METHOD_META[r.paymentMethod] : null;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.date)}</td>

                      <td>
                        {r.isDirect ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                            <UserCheck className="h-3 w-3" /> Direct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <Globe className="h-3 w-3" /> Online
                          </span>
                        )}
                      </td>

                      <td>
                        <p className="text-sm font-medium">{r.customerName}</p>
                        <p className="text-xs text-slate-400">{r.customerEmail}</p>
                      </td>

                      <td>
                        <p className="text-sm font-medium">{r.spaceName}</p>
                        <p className="text-xs text-slate-400">{r.city} · {r.vendorName}</p>
                      </td>

                      <td>
                        {mm ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${mm.cls}`}>
                            {mm.icon} {mm.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="font-semibold">{inr(r.amount)}</td>

                      <td>
                        {r.refundAmount > 0 ? (
                          <div>
                            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                              −{inr(r.refundAmount)}
                            </p>
                            {r.refundNote && (
                              <p className="max-w-[100px] truncate text-[10px] text-slate-400" title={r.refundNote}>
                                {r.refundNote}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sm.cls}`}>
                          {sm.label}
                        </span>
                      </td>

                      <td>
                        <KebabMenu>
                          {r.isDirect && (
                            <MenuItem
                              icon={<Wallet className="h-4 w-4 text-slate-400" />}
                              onClick={() => setMethodRow(r)}
                            >
                              Set Payment Method
                            </MenuItem>
                          )}
                          {(r.status === 'COMPLETED' || r.status === 'PARTIAL_REFUND') &&
                            (r.amount - r.refundAmount) > 0 && (
                              <MenuItem
                                variant="warning"
                                icon={<RotateCcw className="h-4 w-4" />}
                                onClick={() => setRefundRow(r)}
                              >
                                Record Refund
                              </MenuItem>
                            )}
                        </KebabMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {refundRow && <RefundModal row={refundRow} onClose={() => setRefundRow(null)} />}
      {methodRow && <PaymentMethodModal row={methodRow} onClose={() => setMethodRow(null)} />}
    </>
  );
};
