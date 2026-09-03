import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Ban, Car, IndianRupee, Package, PhoneCall, Search,
  ShieldCheck, TrendingUp, Truck, Users, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ────────────────────────────────────────────────────────────────────
interface QrOverview {
  totalRegistrations: number; activeRegistrations: number; pausedRegistrations: number; emergencyEnabled: number;
  callsToday: number; callsTotal: number; answerRate: number; avgDurationSec: number;
  failedTotal: number; blockedNumbersCount: number; spendTodayPaise: number;
  busiestCars: { registrationId: string; plate: string; calls: number }[];
  topCallers: { callerPhoneHash: string; callerMasked: string; calls: number; sampleCallId: string | null }[];
}

interface VehicleOwner { id: string; fullName: string; email: string; phone: string | null }

interface VehicleRow {
  id: string; plateNumber: string; contactPhone: string; contactVerified: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'DELETED';
  emergencyPublic: boolean; ownerName: string | null; dailyReceiveCap: number;
  callCount: number; emergencyContactCount: number; owner: VehicleOwner; createdAt: string;
}

interface VehicleDetail extends Omit<VehicleRow, 'callCount' | 'emergencyContactCount'> {
  isActive: boolean; silentFrom: string | null; silentTo: string | null;
  bloodGroup: string | null; medicalNotes: string | null;
  emergencyContacts: { id: string; name: string; relation: string | null; phone: string; showPublic: boolean }[];
  calls: { id: string; status: string; provider: string; initiatedAt: string; answeredAt: string | null; endedAt: string | null; durationSec: number | null; callerMasked: string }[];
  updatedAt: string;
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

interface OrderRow {
  id: string; status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  stickerPricePaise: number; monthlyPricePaise: number;
  plate: string | null; ownerName: string; ownerEmail: string;
  shippingName: string; shippingPhone: string; addressLine: string;
  city: string; state: string; pincode: string; note: string | null; createdAt: string;
}

const STATUS_CLS: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PAUSED:    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  BRIDGED:   'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  SHIPPED:   'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
  CONFIRMED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PENDING:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};
const statusCls = (s: string) => STATUS_CLS[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const errMsg = (e: unknown, fallback: string) =>
  (e as any)?.response?.data?.error?.message ?? fallback;

// ── Page shell ───────────────────────────────────────────────────────────────
type Tab = 'overview' | 'vehicles' | 'calls' | 'blocked' | 'orders';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'calls',    label: 'Call log' },
  { value: 'blocked',  label: 'Blocked numbers' },
  { value: 'orders',   label: 'Sticker orders' },
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
      {tab === 'orders' && <OrdersTab />}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Active cars" value={data.activeRegistrations} sub={`${data.totalRegistrations} total · ${data.pausedRegistrations} paused`} icon={Car} />
        <StatCard label="Emergency card on" value={data.emergencyEnabled} icon={ShieldCheck} />
        <StatCard label="Calls today" value={data.callsToday} sub={`${data.callsTotal} all-time`} icon={PhoneCall} />
        <StatCard label="Answer rate" value={`${data.answerRate}%`} sub={`avg ${data.avgDurationSec}s`} icon={TrendingUp} />
        <StatCard label="Failed / no-answer" value={data.failedTotal} icon={AlertTriangle} />
        <StatCard label="Numbers blocked" value={data.blockedNumbersCount} icon={Ban} />
        <StatCard label="Spend today" value={`₹${(data.spendTodayPaise / 100).toFixed(2)}`} sub="cost guard — sums CallSession.costPaise" icon={IndianRupee} />
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
                    <td className="font-mono">{c.callerMasked}</td>
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: VehicleRow[] }>({
    queryKey: ['admin-qr-vehicles', search, status],
    queryFn: async () => (await api.get('/admin/qr/vehicles', { params: { search: search || undefined, status: status || undefined } })).data,
  });
  const items = data?.items ?? [];

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
              <th>ICE</th><th>Calls</th><th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">No vehicles found.</td></tr>
            ) : (
              items.map((v) => (
                <tr key={v.id} onClick={() => setSelectedId(v.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="font-mono font-semibold">{v.plateNumber}</td>
                  <td>
                    <p className="font-medium">{v.owner.fullName}</p>
                    <p className="text-xs text-slate-400">{v.owner.email}</p>
                  </td>
                  <td>{v.contactPhone}</td>
                  <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(v.status))}>{v.status}</span></td>
                  <td>{v.emergencyPublic ? <ShieldCheck className="h-4 w-4 text-rose-500" /> : '—'}</td>
                  <td>{v.callCount}</td>
                  <td className="text-xs text-slate-400">{fmtDateTime(v.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedId && <VehicleDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
};

const VehicleDetailModal = ({ id, onClose }: { id: string; onClose: () => void }) => {
  const qc = useQueryClient();
  const [reassignEmail, setReassignEmail] = useState('');
  const [showReassign, setShowReassign] = useState(false);

  const { data, isLoading } = useQuery<{ vehicle: VehicleDetail }>({
    queryKey: ['admin-qr-vehicle', id],
    queryFn: async () => (await api.get(`/admin/qr/vehicles/${id}`)).data,
  });
  const v = data?.vehicle;

  const reassign = useMutation({
    mutationFn: () => api.post(`/admin/qr/vehicles/${id}/reassign`, { ownerEmail: reassignEmail.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-vehicle', id] });
      qc.invalidateQueries({ queryKey: ['admin-qr-vehicles'] });
      setShowReassign(false);
      setReassignEmail('');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>

        {isLoading || !v ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div>
              <span className="rounded-lg border-2 border-slate-800 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider dark:border-slate-300 dark:bg-slate-800">
                {v.plateNumber}
              </span>
              <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(v.status))}>{v.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Owner account" value={`${v.owner.fullName} · ${v.owner.email}`} />
              <Field label="Contact number" value={v.contactPhone} />
              <Field label="Owner name (ICE)" value={v.ownerName ?? '—'} />
              <Field label="Silent hours" value={v.silentFrom || v.silentTo ? `${v.silentFrom ?? '—'} → ${v.silentTo ?? '—'}` : '—'} />
              <Field label="Daily call cap" value={String(v.dailyReceiveCap)} />
              <Field label="Emergency card" value={v.emergencyPublic ? 'On' : 'Off'} />
            </div>

            {v.emergencyPublic && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency card</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Blood group" value={v.bloodGroup ?? '—'} />
                  <Field label="Medical notes" value={v.medicalNotes ?? '—'} />
                </div>
                {v.emergencyContacts.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {v.emergencyContacts.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {c.name}{c.relation ? ` (${c.relation})` : ''} — {c.phone}
                        {!c.showPublic && <span className="text-xs text-slate-400">(hidden)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent calls</h3>
              {v.calls.length === 0 ? (
                <p className="text-xs text-slate-400">No calls yet.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Caller</th><th>Status</th><th>When</th><th>Duration</th></tr></thead>
                  <tbody>
                    {v.calls.slice(0, 10).map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono">{c.callerMasked}</td>
                        <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(c.status))}>{c.status}</span></td>
                        <td className="text-xs text-slate-400">{fmtDateTime(c.initiatedAt)}</td>
                        <td>{c.durationSec != null ? `${c.durationSec}s` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              {!showReassign ? (
                <button type="button" onClick={() => setShowReassign(true)} className="btn-ghost text-sm">
                  Reassign to a different owner (dispute)
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">
                    New owner's account email — they must already have an AutoSahay account.
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={reassignEmail}
                      onChange={(e) => setReassignEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => reassign.mutate()}
                      disabled={!reassignEmail.trim() || reassign.isPending}
                      className="btn-primary shrink-0"
                    >
                      {reassign.isPending ? 'Reassigning…' : 'Reassign'}
                    </button>
                    <button type="button" onClick={() => setShowReassign(false)} className="btn-ghost shrink-0">Cancel</button>
                  </div>
                  {reassign.isError && (
                    <p className="text-xs text-rose-600">{errMsg(reassign.error, 'Could not reassign — check the email is correct.')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

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
                  <td className="font-mono">{c.callerMasked}</td>
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

// ── Sticker orders (fulfilment queue) ───────────────────────────────────────
const ORDER_STATUS_FLOW: OrderRow['status'][] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

const OrdersTab = () => {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: OrderRow[] }>({
    queryKey: ['admin-qr-orders', status],
    queryFn: async () => (await api.get('/admin/qr/orders', { params: { status: status || undefined } })).data,
  });
  const items = data?.items ?? [];

  const setOrderStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.patch(`/admin/qr/orders/${id}/status`, { status: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-qr-orders'] }),
  });

  const nextStatus = (current: OrderRow['status']): OrderRow['status'] | null => {
    const i = ORDER_STATUS_FLOW.indexOf(current);
    return i >= 0 && i < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[i + 1] : null;
  };
  const nextLabel: Record<string, string> = { CONFIRMED: 'Confirm payment', SHIPPED: 'Mark shipped', DELIVERED: 'Mark delivered' };

  return (
    <div className="space-y-4">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48">
        <option value="">All statuses</option>
        {['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Plate</th><th>Requested by</th><th>Price</th><th>Status</th><th>Requested</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">No sticker requests yet.</td></tr>
            ) : (
              items.map((o) => {
                const next = nextStatus(o.status);
                return (
                  <Fragment key={o.id}>
                    <tr onClick={() => setExpanded((e) => (e === o.id ? null : o.id))} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="font-mono font-semibold">{o.plate ?? '—'}</td>
                      <td>
                        <p className="font-medium">{o.ownerName}</p>
                        <p className="text-xs text-slate-400">{o.ownerEmail}</p>
                      </td>
                      <td>₹{(o.stickerPricePaise / 100).toFixed(0)} + ₹{(o.monthlyPricePaise / 100).toFixed(0)}/mo</td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(o.status))}>{o.status}</span></td>
                      <td className="text-xs text-slate-400">{fmtDateTime(o.createdAt)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          {next && (
                            <button
                              type="button"
                              onClick={() => setOrderStatus.mutate({ id: o.id, next })}
                              disabled={setOrderStatus.isPending}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                            >
                              {next === 'SHIPPED' ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />} {nextLabel[next]}
                            </button>
                          )}
                          {o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
                            <button
                              type="button"
                              onClick={() => setOrderStatus.mutate({ id: o.id, next: 'CANCELLED' })}
                              disabled={setOrderStatus.isPending}
                              className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === o.id && (
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
    </div>
  );
};
