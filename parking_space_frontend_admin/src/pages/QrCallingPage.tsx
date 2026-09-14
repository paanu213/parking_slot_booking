import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Ban, Car, IndianRupee, Pencil, PhoneCall,
  Search, ShieldCheck, TrendingUp, Undo2, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { statusCls, fmtDateTime, errMsg } from '@/lib/qrCallingFormat';
import { MaskedPhone } from '@/components/MaskedPhone';
import { VehicleActionsMenu } from '@/components/VehicleActionsMenu';

// ── Types ────────────────────────────────────────────────────────────────────
interface QrOverview {
  totalRegistrations: number; activeRegistrations: number; pausedRegistrations: number; emergencyEnabled: number;
  callsToday: number; callsTotal: number; answerRate: number; avgDurationSec: number;
  failedTotal: number; blockedNumbersCount: number; spendTodayPaise: number;
  revenuePaise: number; refundedPaise: number;
  busiestCars: { registrationId: string; plate: string; calls: number }[];
  topCallers: { callerPhoneHash: string; callerMasked: string; calls: number; sampleCallId: string | null }[];
}

interface VehicleOwner { id: string; fullName: string; email: string; phone: string | null }

interface VehicleRow {
  id: string; plateNumber: string; contactPhone: string; contactVerified: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'DELETED';
  emergencyPublic: boolean; ownerName: string | null;
  validUntil: string | null;
  callCount: number; emergencyContactCount: number; owner: VehicleOwner; createdAt: string;
}

interface CallRow {
  id: string; status: string; provider: string; initiatedAt: string; answeredAt: string | null;
  endedAt: string | null; durationSec: number | null; costPaise: number | null;
  callerMasked: string; plate: string; ownerEmail: string;
}

interface BlockedRow {
  id: string; scope: 'REGISTRATION' | 'GLOBAL'; reason: string | null;
  plate: string | null; blockedBy: string; createdAt: string;
}

interface PaymentRow {
  id: string; status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  provider: string; amount: string; currency: string;
  providerOrderId: string | null; providerPaymentId: string | null;
  failureCode: string | null; failureReason: string | null;
  createdAt: string; updatedAt: string; qrOrderId: string | null;
  customer: { userId: string; name: string; email: string; accountPhone: string | null; shippingPhone: string; plate: string | null } | null;
}

// ── Page shell ───────────────────────────────────────────────────────────────
type Tab = 'overview' | 'vehicles' | 'calls' | 'blocked' | 'payments';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'calls',    label: 'Call log' },
  { value: 'blocked',  label: 'Blocked numbers' },
  { value: 'payments', label: 'Payments' },
];

export default function QrCallingPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <section className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">QR Calling</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vehicle registrations, call log, abuse blocking, and plate disputes.
        </p>
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

      {tab === 'overview' && <OverviewTab />}
      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'calls' && <CallsTab />}
      {tab === 'blocked' && <BlockedTab />}
      {tab === 'payments' && <PaymentsTab />}
    </section>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }> }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2 text-slate-400">
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-1.5 text-2xl font-bold">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

// Platform-wide setting — not per-vehicle. Customers never see or set this;
// only admin can change the number that applies to every car.
const DailyCapSetting = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const { data } = useQuery<{ dailyCap: number }>({
    queryKey: ['admin-qr-daily-cap'],
    queryFn: async () => (await api.get('/admin/qr/settings/daily-cap')).data,
  });

  const update = useMutation({
    mutationFn: (dailyCap: number) => api.patch('/admin/qr/settings/daily-cap', { dailyCap }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-daily-cap'] });
      setEditing(false);
    },
  });

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
      <div className="flex flex-wrap items-center gap-3">
        <PhoneCall className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h2 className="text-sm font-semibold">Daily call cap</h2>
        {editing ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={500}
              className="input h-7 w-20 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <span className="text-sm text-slate-500">calls/day</span>
            <button
              type="button"
              className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={update.isPending || !input}
              onClick={() => update.mutate(Number(input))}
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              {data?.dailyCap ?? '—'} calls/day
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-400"
              onClick={() => { setInput(String(data?.dailyCap ?? 15)); setEditing(true); }}
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Applies to every car platform-wide — the most masked calls one car can receive in a day. Not customer-editable.
      </p>
      {update.isError && (
        <p className="mt-1 text-xs text-rose-600">{errMsg(update.error, 'Could not update the daily call cap.')}</p>
      )}
    </div>
  );
};

const OverviewTab = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<QrOverview>({
    queryKey: ['admin-qr-overview'],
    queryFn: async () => (await api.get('/admin/qr/overview')).data,
  });

  const block = useMutation({
    mutationFn: (callId: string) => api.post(`/admin/qr/calls/${callId}/block`, { reason: 'Flagged from top-caller abuse review' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-overview'] });
      qc.invalidateQueries({ queryKey: ['admin-qr-blocked'] });
    },
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <DailyCapSetting />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Active cars" value={data.activeRegistrations} sub={`${data.totalRegistrations} total · ${data.pausedRegistrations} paused`} icon={Car} />
        <StatCard label="Emergency card on" value={data.emergencyEnabled} icon={ShieldCheck} />
        <StatCard label="Calls today" value={data.callsToday} sub={`${data.callsTotal} all-time`} icon={PhoneCall} />
        <StatCard label="Answer rate" value={`${data.answerRate}%`} sub={`avg ${data.avgDurationSec}s`} icon={TrendingUp} />
        <StatCard label="Failed / no-answer" value={data.failedTotal} icon={AlertTriangle} />
        <StatCard label="Numbers blocked" value={data.blockedNumbersCount} icon={Ban} />
        <StatCard label="Spend today" value={`₹${(data.spendTodayPaise / 100).toFixed(2)}`} sub="cost guard — sums CallSession.costPaise" icon={IndianRupee} />
        <StatCard label="Sticker revenue" value={`₹${(data.revenuePaise / 100).toFixed(2)}`} sub="received from QR sticker orders" icon={Wallet} />
        <StatCard label="Refunded" value={`₹${(data.refundedPaise / 100).toFixed(2)}`} sub="refunded from sticker orders" icon={Undo2} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Busiest cars</h2>
          {data.busiestCars.length === 0 ? (
            <p className="text-xs text-slate-400">No calls yet.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Plate</th><th>Calls</th></tr></thead>
              <tbody>
                {data.busiestCars.map((c) => (
                  <tr key={c.registrationId}>
                    <td className="font-mono">{c.plate}</td>
                    <td>{c.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Top callers (last 30 days)</h2>
          {data.topCallers.length === 0 ? (
            <p className="text-xs text-slate-400">No calls yet.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Number</th><th>Calls</th><th /></tr></thead>
              <tbody>
                {data.topCallers.map((c) => (
                  <tr key={c.callerPhoneHash}>
                    <td><MaskedPhone masked={c.callerMasked} callId={c.sampleCallId} /></td>
                    <td>{c.calls}</td>
                    <td className="text-right">
                      {c.sampleCallId && (
                        <button
                          type="button"
                          onClick={() => block.mutate(c.sampleCallId!)}
                          disabled={block.isPending}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                        >
                          <Ban className="h-3 w-3" /> Block globally
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Vehicles ─────────────────────────────────────────────────────────────────
const VehiclesTab = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<{ items: VehicleRow[] }>({
    queryKey: ['admin-qr-vehicles', search, status],
    queryFn: async () => (await api.get('/admin/qr/vehicles', { params: { search: search || undefined, status: status || undefined } })).data,
  });
  const items = data?.items ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-qr-vehicles'] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, owner name or email"
            className="input w-72 pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-40">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Plate</th><th>Owner</th><th>Contact</th><th>Status</th>
              <th>ICE</th><th>QR validity</th><th>Calls</th><th>Registered</th><th />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">No vehicles found.</td></tr>
            ) : (
              items.map((v) => {
                const expired = v.validUntil ? new Date(v.validUntil).getTime() < Date.now() : false;
                return (
                <tr key={v.id} onClick={() => navigate(`/qr-calling/vehicles/${v.id}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="font-mono font-semibold">{v.plateNumber}</td>
                  <td>
                    <p className="font-medium">{v.owner.fullName}</p>
                    <p className="text-xs text-slate-400">{v.owner.email}</p>
                  </td>
                  <td>{v.contactPhone}</td>
                  <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(v.status))}>{v.status}</span></td>
                  <td>{v.emergencyPublic ? <ShieldCheck className="h-4 w-4 text-rose-500" /> : '—'}</td>
                  <td>
                    {v.validUntil ? (
                      <span className={cn('text-xs font-semibold', expired ? 'text-rose-600' : 'text-amber-700 dark:text-amber-400')}>
                        {expired ? 'Expired ' : 'Until '}{new Date(v.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Lifetime</span>
                    )}
                  </td>
                  <td>{v.callCount}</td>
                  <td className="text-xs text-slate-400">{fmtDateTime(v.createdAt)}</td>
                  <td className="text-right">
                    <VehicleActionsMenu
                      vehicle={{ id: v.id, status: v.status, contactPhone: v.contactPhone, validUntil: v.validUntil }}
                      onChanged={refresh}
                    />
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

// Vehicle detail now lives at its own route — see QrVehicleDetailPage.tsx
// (was a modal here; moved so it's linkable and back/forward-navigable).

// ── Call log ─────────────────────────────────────────────────────────────────
const CALL_STATUS_OPTIONS = ['COMPLETED', 'BRIDGED', 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED', 'FAILED', 'BLOCKED', 'CANCELLED'];

const CallsTab = () => {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<{ items: CallRow[] }>({
    queryKey: ['admin-qr-calls', status],
    queryFn: async () => (await api.get('/admin/qr/calls', { params: { status: status || undefined } })).data,
  });
  const items = data?.items ?? [];

  const block = useMutation({
    mutationFn: (callId: string) => api.post(`/admin/qr/calls/${callId}/block`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-calls'] });
      qc.invalidateQueries({ queryKey: ['admin-qr-blocked'] });
    },
  });

  return (
    <div className="space-y-4">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48">
        <option value="">All statuses</option>
        {CALL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Plate</th><th>Owner</th><th>Caller</th><th>Status</th><th>When</th><th>Duration</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">No calls found.</td></tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">{c.plate}</td>
                  <td className="text-xs text-slate-400">{c.ownerEmail}</td>
                  <td><MaskedPhone masked={c.callerMasked} callId={c.id} /></td>
                  <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(c.status))}>{c.status}</span></td>
                  <td className="text-xs text-slate-400">{fmtDateTime(c.initiatedAt)}</td>
                  <td>{c.durationSec != null ? `${c.durationSec}s` : '—'}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => block.mutate(c.id)}
                      disabled={block.isPending}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                    >
                      <Ban className="h-3 w-3" /> Block
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Blocked numbers ──────────────────────────────────────────────────────────
const BlockedTab = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: BlockedRow[] }>({
    queryKey: ['admin-qr-blocked'],
    queryFn: async () => (await api.get('/admin/qr/blocked')).data,
  });
  const items = data?.items ?? [];

  const unblock = useMutation({
    mutationFn: (rowId: string) => api.delete(`/admin/qr/blocked/${rowId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-qr-blocked'] }),
  });

  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Scope</th><th>Plate</th><th>Reason</th><th>Blocked by</th><th>Date</th><th /></tr></thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} className="py-6 text-center text-slate-400">No numbers blocked.</td></tr>
          ) : (
            items.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', r.scope === 'GLOBAL' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
                    {r.scope === 'GLOBAL' ? 'All cars' : 'One car'}
                  </span>
                </td>
                <td className="font-mono">{r.plate ?? '—'}</td>
                <td className="text-xs text-slate-500">{r.reason ?? '—'}</td>
                <td className="text-xs text-slate-400">{r.blockedBy}</td>
                <td className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}</td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => unblock.mutate(r.id)}
                    disabled={unblock.isPending}
                    className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Payments — every attempt (paid or failed), with contact details so
// support can call a customer stuck mid-payment. ─────────────────────────────
const PaymentsTab = () => {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');

  const { data, isLoading } = useQuery<{ items: PaymentRow[] }>({
    queryKey: ['admin-qr-payments', status, q],
    queryFn: async () => (await api.get('/admin/qr/payments', { params: { status: status || undefined, q: q || undefined } })).data,
  });
  const items = data?.items ?? [];

  const summary = items.reduce(
    (acc, p) => {
      if (p.status === 'PAID') { acc.paidCount++; acc.paidTotal += Number(p.amount); }
      else if (p.status === 'FAILED') acc.failedCount++;
      return acc;
    },
    { paidCount: 0, paidTotal: 0, failedCount: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48">
          <option value="">All statuses</option>
          {['CREATED', 'PAID', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search name, email, phone, plate, order id…"
              className="input w-72 pl-8"
            />
          </div>
          <button type="submit" className="btn-ghost text-sm">Search</button>
          {q && <button type="button" onClick={() => { setQ(''); setQInput(''); }} className="text-xs font-semibold text-slate-500 hover:underline">Clear</button>}
        </form>
        <span className="ml-auto text-xs text-slate-400">
          {summary.paidCount} paid (₹{summary.paidTotal.toFixed(0)}) · {summary.failedCount} failed, of {items.length} shown
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Customer</th><th>Plate</th><th>Amount</th><th>Status</th><th>Gateway ref</th><th>When</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">No payment attempts yet.</td></tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="align-top">
                  <td>
                    {p.customer ? (
                      <>
                        <p className="font-medium">{p.customer.name}</p>
                        <p className="text-xs text-slate-400">{p.customer.email}</p>
                        <p className="text-xs text-slate-400">
                          {[p.customer.accountPhone, p.customer.shippingPhone].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((ph) => (
                            <a key={ph} href={`tel:${ph}`} className="mr-2 text-brand-600 hover:underline">{ph}</a>
                          ))}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="font-mono font-semibold">{p.customer?.plate ?? '—'}</td>
                  <td>₹{Number(p.amount).toFixed(0)}</td>
                  <td>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(p.status))}>{p.status}</span>
                    {p.status === 'FAILED' && p.failureReason && (
                      <p className="mt-1 max-w-[220px] text-xs text-rose-500">{p.failureCode ? `${p.failureCode}: ` : ''}{p.failureReason}</p>
                    )}
                  </td>
                  <td className="text-xs text-slate-400">
                    {p.providerPaymentId && <p className="font-mono">{p.providerPaymentId}</p>}
                    {p.providerOrderId && <p className="font-mono">{p.providerOrderId}</p>}
                    <p className="mt-0.5 uppercase">{p.provider}</p>
                  </td>
                  <td className="text-xs text-slate-400">{fmtDateTime(p.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

