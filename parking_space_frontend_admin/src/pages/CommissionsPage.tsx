import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Percent, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { api } from '@/lib/api';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v ?? 0));

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

type StatusFilter = 'ALL' | 'PENDING' | 'PAID';

type Period = 'day' | 'month' | 'year' | 'fy' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day',   label: 'Today' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
  { key: 'fy',    label: 'FY' },
  { key: 'custom', label: 'Custom' },
];

export default function CommissionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const params =
    period === 'custom'
      ? (from && to ? { period: 'custom', from, to } : { period: 'month' })
      : { period };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-commissions', params],
    queryFn: async () => (await api.get('/admin/commission/summary', { params })).data,
  });

  // Individual commission records (with the status filter applied).
  const recordParams = { ...params, ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}) };
  const { data: recordsData, isLoading: recordsLoading } = useQuery({
    queryKey: ['admin-commission-records', recordParams],
    queryFn: async () => (await api.get('/admin/commission/bookings', { params: recordParams })).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-commission-records'] });
    qc.invalidateQueries({ queryKey: ['admin-commissions'] });
    qc.invalidateQueries({ queryKey: ['admin-commission-overview'] });
  };
  const setPaid = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PAID' | 'PENDING' }) =>
      api.patch(`/admin/bookings/${id}/commission`, { status }),
    onSuccess: invalidate,
  });

  const byVendor: any[] = data?.byVendor ?? [];
  const records: any[] = recordsData?.items ?? [];

  return (
    <section className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Commission owed to the company by vendors, on confirmed &amp; completed bookings.
          </p>
        </div>
        {data && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Rate: {data.rate}%
          </span>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                period === key
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-amber-100 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-36 text-xs sm:w-40" />
            <span className="text-slate-400">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-36 text-xs sm:w-40" />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={<Percent className="h-4 w-4 text-amber-600 dark:text-amber-300" />} accent="bg-amber-100 dark:bg-amber-900/30"
              label="Total Commission" value={inr(data?.totalCommission)} sub={`${data?.bookings ?? 0} bookings`} />
        <Card icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />} accent="bg-emerald-100 dark:bg-emerald-900/30"
              label="Collected" value={inr(data?.paidCommission)} />
        <Card icon={<Clock className="h-4 w-4 text-red-600 dark:text-red-300" />} accent="bg-red-100 dark:bg-red-900/30"
              label="Pending Collection" value={inr(data?.pendingCommission)} />
        <Card icon={<Wallet className="h-4 w-4 text-blue-600 dark:text-blue-300" />} accent="bg-blue-100 dark:bg-blue-900/30"
              label="Gross Revenue" value={inr(data?.grossRevenue)} />
      </div>

      {/* Per-vendor breakdown */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">By Vendor <span className="text-slate-400">({byVendor.length})</span></h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
        ) : byVendor.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No commission in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Vendor</th><th>Bookings</th><th>Total</th><th>Collected</th><th>Pending</th></tr>
              </thead>
              <tbody>
                {byVendor.map((v) => (
                  <tr key={v.vendorId} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      onClick={() => navigate(`/vendors/${v.vendorId}`)}>
                    <td className="font-medium text-brand-600 dark:text-brand-400">{v.businessName}</td>
                    <td className="text-sm text-slate-500">{v.bookings}</td>
                    <td className="font-semibold">{inr(v.total)}</td>
                    <td className="text-emerald-600 dark:text-emerald-400">{inr(v.paid)}</td>
                    <td className={v.pending > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400'}>
                      {inr(v.pending)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission records — mark received, filter by status */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Commission Records <span className="text-slate-400">({records.length})</span></h2>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'PAID'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'PENDING' ? 'Pending' : 'Received'}
              </button>
            ))}
          </div>
        </div>
        {recordsLoading ? (
          <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No commission records for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Reference</th><th>Vendor</th><th>Space</th><th>Commission</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {records.map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs text-slate-500">{fmtDate(b.createdAt)}</td>
                    <td className="font-mono text-xs">{b.reference}</td>
                    <td className="text-sm font-medium text-brand-600 dark:text-brand-400">
                      <button onClick={() => b.vendorId && navigate(`/vendors/${b.vendorId}`)} className="hover:underline">
                        {b.vendorName}
                      </button>
                    </td>
                    <td className="text-sm text-slate-500">{b.spaceName}</td>
                    <td className="font-semibold">{inr(b.commissionAmount)}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.commissionStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {b.commissionStatus === 'PAID' ? 'Received' : 'Pending'}
                      </span>
                    </td>
                    <td className="text-right">
                      {b.commissionStatus === 'PAID' ? (
                        <button
                          onClick={() => setPaid.mutate({ id: b.id, status: 'PENDING' })}
                          disabled={setPaid.isPending}
                          className="btn-ghost text-xs"
                        >
                          Mark Pending
                        </button>
                      ) : (
                        <button
                          onClick={() => setPaid.mutate({ id: b.id, status: 'PAID' })}
                          disabled={setPaid.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Received
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const Card = ({
  icon, label, value, sub, accent,
}: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
    <div className="mt-2 text-2xl font-bold">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
  </div>
);
