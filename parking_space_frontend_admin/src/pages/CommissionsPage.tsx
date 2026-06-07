import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Percent, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { api } from '@/lib/api';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v ?? 0));

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
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params =
    period === 'custom'
      ? (from && to ? { period: 'custom', from, to } : { period: 'month' })
      : { period };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-commissions', params],
    queryFn: async () => (await api.get('/admin/commission/summary', { params })).data,
  });

  const byVendor: any[] = data?.byVendor ?? [];

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
