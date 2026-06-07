import { useEffect, useState, useRef, useMemo } from 'react';
import { BrowserRouter, Route, Routes, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Sparkles, Check, CheckCircle2, X,
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Building2, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation, Car, Bike, Truck,
  CalendarCheck, Users, MapPin,
  TrendingUp, Activity, UploadCloud, FileText, AlertCircle,
  XCircle, ChevronDown, CalendarRange, Search, Percent, Wallet,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { AppShell } from '@/components/AppShell';
import { BookingsPage } from '@/pages/BookingsPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { AdminsPage } from '@/pages/AdminsPage';
import { SpacesPage } from '@/pages/SpacesPage';
import { SpaceEditPage } from '@/pages/SpaceEditPage';
import SpaceDetailsPage from '@/pages/SpaceDetailsPage';
import CommissionsPage from '@/pages/CommissionsPage';
import { AddVendorPage } from '@/pages/AddVendorPage';
import { AddSpacePage } from '@/pages/AddSpacePage';
import { LoginPage } from '@/pages/LoginPage';
import { KebabMenu, MenuItem, MenuDivider } from '@/components/KebabMenu';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailsPage } from '@/pages/CustomerDetailsPage';
import { VendorDetailsPage } from '@/pages/VendorDetailsPage';
import { SlotBookingsPage } from '@/pages/SlotBookingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AccountPage } from '@/pages/AccountPage';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'];

const qc = new QueryClient();

const HydrateSession = () => {
  const setSession = useAuth((s) => s.setSession);
  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setSession(r.data?.user ?? null))
      .catch(() => setSession(null));
  }, [setSession]);
  return null;
};

// ── Shared helpers ────────────────────────────────────────────────────────────
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const BOOKING_STATUS_CLS: Record<string, string> = {
  CONFIRMED:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING:    'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  CANCELLED:  'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  COMPLETED:  'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
};

const PAYMENT_STATUS_CLS: Record<string, string> = {
  PAID:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING: 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  FAILED:  'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  REFUNDED:'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-300',
};

const StatusBadge = ({ status, map }: { status: string; map: Record<string, string> }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
    {status}
  </span>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
type Tone = 'emerald' | 'blue' | 'violet' | 'amber';
const TONE_CLS: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  blue:    'bg-blue-50    text-blue-600    dark:bg-blue-900/20    dark:text-blue-400',
  violet:  'bg-violet-50  text-violet-600  dark:bg-violet-900/20  dark:text-violet-400',
  amber:   'bg-amber-50   text-amber-600   dark:bg-amber-900/20   dark:text-amber-400',
};

const StatCard = ({
  label, value, sub, icon: Icon, tone,
}: {
  label: string; value: string | number; sub?: string; icon: LucideFC; tone: Tone;
}) => (
  <div className="card flex items-center gap-4 p-5">
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONE_CLS[tone]}`}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  </div>
);

// ── Section card wrapper ───────────────────────────────────────────────────────
const SectionCard = ({
  icon: Icon, iconCls, title, badge, tag, linkTo, linkLabel, children,
}: {
  icon: LucideFC; iconCls: string; title: string; badge?: number; tag?: string;
  linkTo?: string; linkLabel?: string; children: React.ReactNode;
}) => (
  <div className="card overflow-hidden">
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconCls}`} />
        <p className="text-sm font-semibold">{title}</p>
        {badge != null && badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {badge}
          </span>
        )}
        {tag && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
            {tag}
          </span>
        )}
      </div>
      {linkTo && (
        <Link to={linkTo} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
          {linkLabel ?? 'View all →'}
        </Link>
      )}
    </div>
    {children}
  </div>
);

// ── Date-range helpers ────────────────────────────────────────────────────────
type RangeKey =
  | 'today' | 'this_week' | 'this_month' | 'this_year'
  | 'last_week' | 'last_month' | 'last_year'
  | 'this_fy' | 'last_fy' | 'custom';

interface DateRange { start: Date; end: Date; label: string }

function buildRange(key: RangeKey, custom?: { start: string; end: string }): DateRange {
  const now     = new Date();
  const todayS  = new Date(now); todayS.setHours(0,  0,  0,   0);
  const todayE  = new Date(now); todayE.setHours(23, 59, 59, 999);

  switch (key) {
    case 'today':
      return { start: todayS, end: todayE, label: 'Today' };

    case 'this_week': {
      const mon = new Date(todayS);
      mon.setDate(todayS.getDate() - ((now.getDay() + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
      return { start: mon, end: sun, label: 'This Week' };
    }

    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e, label: 'This Month' };
    }

    case 'this_year': {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: s, end: e, label: 'This Year' };
    }

    case 'last_week': {
      const thisMon = new Date(todayS);
      thisMon.setDate(todayS.getDate() - ((now.getDay() + 6) % 7));
      const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
      const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1); lastSun.setHours(23, 59, 59, 999);
      return { start: lastMon, end: lastSun, label: 'Last Week' };
    }

    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s, end: e, label: 'Last Month' };
    }

    case 'last_year': {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const e = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { start: s, end: e, label: 'Last Year' };
    }

    case 'this_fy': {
      // Indian FY: 1 Apr – 31 Mar
      const fyY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const s = new Date(fyY, 3, 1);
      const e = new Date(fyY + 1, 2, 31, 23, 59, 59, 999);
      return { start: s, end: e, label: `FY ${fyY}–${String(fyY + 1).slice(2)}` };
    }

    case 'last_fy': {
      const fyY = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      const s = new Date(fyY, 3, 1);
      const e = new Date(fyY + 1, 2, 31, 23, 59, 59, 999);
      return { start: s, end: e, label: `FY ${fyY}–${String(fyY + 1).slice(2)}` };
    }

    case 'custom':
      if (custom?.start && custom?.end) {
        const s = new Date(custom.start + 'T00:00:00');
        const e = new Date(custom.end   + 'T23:59:59');
        const fmt = (d: Date) =>
          d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
        return { start: s, end: e, label: `${fmt(s)} – ${fmt(e)}` };
      }
      return { start: todayS, end: todayE, label: 'Custom' };

    default:
      return { start: todayS, end: todayE, label: 'Today' };
  }
}

const QUICK_RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
];

const MORE_RANGES: { key: RangeKey; label: string }[] = [
  { key: 'last_week',  label: 'Last Week' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_year',  label: 'Last Year' },
  { key: 'this_fy',    label: 'This Financial Year' },
  { key: 'last_fy',    label: 'Last Financial Year' },
  { key: 'custom',     label: 'Custom Range…' },
];

// ── Overview / Dashboard ──────────────────────────────────────────────────────
const Overview = () => {
  const client = useQueryClient();

  const [rangeKey,    setRangeKey]    = useState<RangeKey>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [showMore,    setShowMore]    = useState(false);
  const [showCustom,  setShowCustom]  = useState(false);

  const range = buildRange(
    rangeKey,
    rangeKey === 'custom' ? { start: customStart, end: customEnd } : undefined,
  );

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', range.start.toISOString(), range.end.toISOString()],
    queryFn: async () =>
      (await api.get('/admin/stats', {
        params: { start: range.start.toISOString(), end: range.end.toISOString() },
      })).data,
    refetchInterval: 60_000,
    enabled: rangeKey !== 'custom' || (customStart !== '' && customEnd !== ''),
  });

  // Platform-wide commission (all-time) for the dashboard widget.
  const { data: commission } = useQuery({
    queryKey: ['admin-commission-overview'],
    queryFn: async () => (await api.get('/admin/commission/summary')).data,
    refetchInterval: 60_000,
  });

  const approve = useMutation({
    mutationFn: ({ type, id }: { type: 'vendor' | 'space'; id: string }) =>
      type === 'vendor'
        ? api.post(`/admin/vendors/${id}/approve`)
        : api.post(`/admin/spaces/${id}/approve`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-stats'] });
      client.invalidateQueries({ queryKey: ['vendors'] });
      client.invalidateQueries({ queryKey: ['admin-spaces'] });
    },
  });

  const selectRange = (key: RangeKey) => {
    setRangeKey(key);
    setShowMore(false);
    if (key === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
  };

  // Close "More" dropdown on outside click
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Is the active range key in the "More" list?
  const activeIsMore = MORE_RANGES.some((r) => r.key === rangeKey);

  return (
    <section className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          Live
        </div>
      </div>

      {/* ══ Period Analysis card — filter + filtered KPIs in one box ══ */}
      {/* NOTE: NO overflow-hidden here — the "More" dropdown is absolutely-positioned
          and must escape the card boundary. See CLAUDE.md § Dropdowns rule. */}
      <div className="card">

        {/* Card header — title left, controls right */}
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">

            {/* Left: icon + title + active period chip */}
            <div className="flex items-center gap-2 pt-1">
              <CalendarRange className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold">Period Analysis</span>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                {range.label}
              </span>
            </div>

            {/* Right: stacked controls column — tabs row, then date inputs below when custom */}
            <div className="flex flex-col items-end gap-2">

              {/* Row 1: quick tabs + More dropdown */}
              <div className="flex items-center gap-2">
                {/* Quick-select pill tabs */}
                <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
                  {QUICK_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => selectRange(r.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                        rangeKey === r.key
                          ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* "More" dropdown */}
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      activeIsMore
                        ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {activeIsMore ? range.label : 'More'}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                  </button>

                  {showMore && (
                    <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[190px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {MORE_RANGES.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => selectRange(r.key)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                            rangeKey === r.key
                              ? 'font-semibold text-brand-700 dark:text-brand-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {rangeKey === r.key && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          )}
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: custom date inputs — slides in directly below the tabs/More button */}
              {showCustom && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">From</span>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || undefined}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="input w-36 py-1.5 text-xs sm:w-40"
                  />
                  <span className="shrink-0 text-xs text-slate-400">→</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart || undefined}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="input w-36 py-1.5 text-xs sm:w-40"
                  />
                  {customStart && customEnd && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
                      ✓ Applied
                    </span>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Card body — filtered KPI cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            <StatCard
              label="Revenue"
              value={inr(stats?.range?.revenue ?? 0)}
              sub="from paid bookings"
              icon={TrendingUp}
              tone="emerald"
            />
            <StatCard
              label="New Bookings"
              value={(stats?.range?.bookings ?? 0).toLocaleString()}
              sub={`${stats?.range?.confirmed ?? 0} confirmed`}
              icon={CalendarCheck}
              tone="blue"
            />
            <StatCard
              label="Confirmed"
              value={(stats?.range?.confirmed ?? 0).toLocaleString()}
              sub="successfully confirmed"
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              label="Cancelled"
              value={(stats?.range?.cancelled ?? 0).toLocaleString()}
              sub="cancelled in period"
              icon={XCircle}
              tone="amber"
            />
          </div>
        )}
      </div>

      {/* ══ Platform Overview — static / all-time counts ══ */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Platform Overview
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Active Spaces"
              value={stats?.spaces?.approved ?? 0}
              sub={`${stats?.spaces?.total ?? 0} total listed`}
              icon={MapPin}
              tone="violet"
            />
            <StatCard
              label="Approved Vendors"
              value={stats?.vendors?.approved ?? 0}
              sub={`${stats?.vendors?.total ?? 0} total registered`}
              icon={Users}
              tone="blue"
            />
            <StatCard
              label="Pending Approvals"
              value={(stats?.vendors?.pending ?? 0) + (stats?.spaces?.pending ?? 0)}
              sub={`${stats?.vendors?.pending ?? 0} vendors · ${stats?.spaces?.pending ?? 0} spaces`}
              icon={AlertCircle}
              tone="amber"
            />
            <StatCard
              label="Profile Edit Requests"
              value={stats?.vendors?.pendingProfileEdits ?? 0}
              sub="vendor edits pending review"
              icon={Activity}
              tone="violet"
            />
          </div>
        )}
      </div>

      {/* ══ Commission (platform-wide, all-time) ══ */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Commission Owed by Vendors · All time
          </p>
          <Link to="/commissions" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            View details →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Commission" value={inr(commission?.totalCommission ?? 0)}
                    sub={`at ${commission?.rate ?? '—'}% rate`} icon={Percent} tone="amber" />
          <StatCard label="Collected" value={inr(commission?.paidCommission ?? 0)}
                    sub="received from vendors" icon={CheckCircle2} tone="emerald" />
          <StatCard label="Pending Collection" value={inr(commission?.pendingCommission ?? 0)}
                    sub="still owed" icon={Clock} tone="amber" />
          <StatCard label="Gross Revenue" value={inr(commission?.grossRevenue ?? 0)}
                    sub="confirmed + completed" icon={Wallet} tone="blue" />
        </div>
      </div>

      {/* Pending actions — three columns on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pending vendors */}
        <SectionCard
          icon={Users}
          iconCls="text-amber-500"
          title="Pending Vendor Approvals"
          badge={stats?.vendors?.pending}
          tag="All time"
          linkTo="/vendors"
          linkLabel="View all →"
        >
          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-12" /><div className="skeleton h-12" />
            </div>
          ) : (stats?.recent?.pendingVendors ?? []).length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              All clear — no pending vendors
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.recent.pendingVendors.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.businessName}</p>
                    <p className="truncate text-xs text-slate-400">{v.user?.email}</p>
                  </div>
                  <button
                    className="btn-primary shrink-0 text-xs"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ type: 'vendor', id: v.id })}
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pending spaces */}
        <SectionCard
          icon={MapPin}
          iconCls="text-violet-500"
          title="Pending Space Reviews"
          badge={stats?.spaces?.pending}
          tag="All time"
          linkTo="/spaces"
          linkLabel="View all →"
        >
          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-12" /><div className="skeleton h-12" />
            </div>
          ) : (stats?.recent?.pendingSpaces ?? []).length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              All clear — no spaces pending review
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.recent.pendingSpaces.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {s.city}, {s.state} · {s.vendor?.businessName}
                    </p>
                  </div>
                  <button
                    className="btn-primary shrink-0 text-xs"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ type: 'space', id: s.id })}
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pending vendor profile edits */}
        <SectionCard
          icon={AlertCircle}
          iconCls="text-blue-500"
          title="Pending Profile Edit Requests"
          badge={stats?.vendors?.pendingProfileEdits}
          tag="All time"
          linkTo="/vendors"
          linkLabel="View all →"
        >
          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-12" /><div className="skeleton h-12" />
            </div>
          ) : (stats?.recent?.profileEdits ?? []).length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              All clear — no pending profile edits
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.recent.profileEdits.map((v: any) => {
                const pending = v.pendingProfileData
                  ? (() => { try { return JSON.parse(v.pendingProfileData) as Record<string, string>; } catch { return {}; } })()
                  : {};
                const changedFields = Object.keys(pending).filter((k) => pending[k]);
                return (
                  <div key={v.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{v.businessName}</p>
                        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          edit
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-400">{v.user?.email}</p>
                      {changedFields.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          Changes: {changedFields.join(', ')}
                        </p>
                      )}
                    </div>
                    <Link
                      to="/vendors"
                      className="btn-ghost shrink-0 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      Review →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent bookings — always all-time, not filtered by period */}
      <SectionCard
        icon={CalendarCheck}
        iconCls="text-blue-500"
        title="Recent Bookings"
        tag="All time"
        linkTo="/bookings"
        linkLabel="View all →"
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10" />)}
          </div>
        ) : (stats?.recent?.bookings ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Space · Slot</th>
                  <th>Date</th>
                  <th>Hrs</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.bookings.map((b: any) => {
                  const hrs = Math.max(1, Math.ceil(
                    (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000,
                  ));
                  return (
                    <tr key={b.id}>
                      <td>
                        <p className="text-sm font-medium">
                          {b.isDirectBooking
                            ? (b.guestName ?? 'Walk-in Guest')
                            : (b.user?.fullName ?? '—')}
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.isDirectBooking
                            ? (b.guestPhone ?? 'Direct booking')
                            : (b.user?.email ?? '')}
                        </p>
                      </td>
                      <td className="text-sm">
                        {b.slot?.location?.name}
                        <span className="ml-1 font-mono text-xs text-slate-400">· {b.slot?.code}</span>
                      </td>
                      <td className="text-xs text-slate-500">{fmtDate(b.startAt)}</td>
                      <td>
                        <span className="font-semibold">{hrs}</span>
                        <span className="text-xs text-slate-400"> hr{hrs !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="font-semibold">{inr(Number(b.totalAmount))}</td>
                      <td><StatusBadge status={b.status} map={BOOKING_STATUS_CLS} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </section>
  );
};

// ── Vendors ───────────────────────────────────────────────────────────────────
const VENDOR_STATUS_CLS: Record<string, string> = {
  PENDING:  'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  REJECTED: 'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  INACTIVE: 'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
};

const VENDOR_TABS = [
  { value: 'ALL',      label: 'All' },
  { value: 'PENDING',  label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;
type VendorTab = typeof VENDOR_TABS[number]['value'];

// ── Inline doc upload helper (shared by modals) ───────────────────────────────
const DocUploadField = ({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<{ url: string }>('/uploads/documents', fd).then((r) => r.data.url);
    },
    onSuccess: onUploaded,
  });

  const isPdf = currentUrl?.endsWith('.pdf');

  // Single hidden input — used by both "Replace" (when doc exists) and the upload zone
  const fileInput = (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp,application/pdf"
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }}
    />
  );

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          {/* Doc preview row */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            {isPdf
              ? <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            <a href={currentUrl} target="_blank" rel="noreferrer"
              className="flex-1 truncate text-xs text-emerald-700 underline dark:text-emerald-300">
              {upload.isPending ? 'Uploading new document…' : 'View current document'}
            </a>
            <button type="button" onClick={() => onUploaded(null)}
              className="shrink-0 text-slate-400 hover:text-red-500 transition"
              title="Remove document">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Replace action */}
          <div className="border-t border-emerald-200 px-3 py-2 dark:border-emerald-800/40">
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => ref.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 transition"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {upload.isPending ? 'Uploading…' : 'Replace with a new document'}
            </button>
          </div>
          {fileInput}
        </div>
      ) : (
        <div
          onClick={() => !upload.isPending && ref.current?.click()}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5 transition
            ${upload.isPending ? 'pointer-events-none opacity-60' : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'}`}
        >
          <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-xs text-slate-500">
            {upload.isPending ? 'Uploading…' : 'Upload Aadhar document (image or PDF)'}
          </span>
          {fileInput}
        </div>
      )}
      {upload.isError && (
        <p className="text-xs text-red-500">Upload failed. Please try again.</p>
      )}
    </div>
  );
};

// ── Edit Vendor Modal ─────────────────────────────────────────────────────────
const EditVendorModal = ({
  vendor,
  onClose,
  onSaved,
}: {
  vendor:  any;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({
    // Business fields
    businessName: vendor.businessName        ?? '',
    contactPhone: vendor.contactPhone        ?? '',
    address:      vendor.address             ?? '',
    // Owner / User fields
    fullName:     vendor.user?.fullName      ?? '',
    phone:        vendor.user?.phone         ?? '',
    email:        vendor.user?.email         ?? '',
    // KYC
    aadharNumber: vendor.aadharNumber        ?? '',
  });
  const [aadharDocUrl, setAadharDocUrl] = useState<string | null>(vendor.aadharDocUrl ?? null);
  const [err, setErr] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/vendors/${vendor.id}`, {
      businessName: form.businessName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      address:      form.address.trim()      || undefined,
      fullName:     form.fullName.trim()     || undefined,
      phone:        form.phone.trim()        || undefined,
      email:        form.email.trim()        || undefined,
      aadharNumber: form.aadharNumber.trim() || undefined,
      aadharDocUrl: aadharDocUrl             || undefined,
    }),
    onSuccess:  onSaved,
    onError:    (e: any) => setErr(e?.response?.data?.message ?? 'Failed to save changes'),
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErr('');
    };

  // Phone fields: digits only, capped at 10.
  const setPhone = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, 10) }));
      setErr('');
    };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
      {children}
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh]">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Edit Vendor</h2>
            <p className="mt-0.5 text-sm text-slate-500">{vendor.businessName}</p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">

          {/* ── Business Details ── */}
          <div>
            <SectionLabel>Business Details</SectionLabel>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Business Name</label>
                <input className="input w-full" placeholder="e.g. City Park Pvt. Ltd."
                  value={form.businessName} onChange={set('businessName')} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Business Contact Phone</label>
                  <input className="input w-full" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile"
                    value={form.contactPhone} onChange={setPhone('contactPhone')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Business Address</label>
                  <input className="input w-full" placeholder="Business address"
                    value={form.address} onChange={set('address')} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Owner Account ── */}
          <div>
            <SectionLabel>Owner Account</SectionLabel>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                  <input className="input w-full" placeholder="Owner's full name"
                    value={form.fullName} onChange={set('fullName')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Personal Phone</label>
                  <input className="input w-full" type="tel" inputMode="numeric" maxLength={10} placeholder="Personal phone (optional)"
                    value={form.phone} onChange={setPhone('phone')} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                <input className="input w-full" type="email" placeholder="vendor@example.com"
                  value={form.email} onChange={set('email')} />
              </div>
            </div>
          </div>

          {/* ── KYC ── */}
          <div>
            <SectionLabel>
              <ShieldCheck className="h-3.5 w-3.5 text-brand-500" /> KYC Details
            </SectionLabel>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Aadhar Number</label>
                <input className="input w-full" placeholder="XXXX XXXX XXXX" maxLength={14}
                  value={form.aadharNumber} onChange={set('aadharNumber')} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Aadhar Document</label>
                <DocUploadField currentUrl={aadharDocUrl} onUploaded={setAadharDocUrl} />
              </div>
            </div>
          </div>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{err}</p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="btn-primary flex-1">
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Vendors = () => {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [tab,               setTab]               = useState<VendorTab>('ALL');
  const [rejectingId,       setRejectingId]       = useState<string | null>(null);
  const [rejectNote,        setRejectNote]        = useState('');
  const [editVendorId,      setEditVendorId]      = useState<string | null>(null);
  const [profileRejectId,   setProfileRejectId]   = useState<string | null>(null);
  const [profileRejectNote, setProfileRejectNote] = useState('');
  const [stateFilter,       setStateFilter]       = useState<string | null>(null);
  const [cityFilter,        setCityFilter]        = useState<string | null>(null);
  const [search,            setSearch]            = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', tab],
    queryFn: async () =>
      (await api.get('/admin/vendors', { params: tab !== 'ALL' ? { status: tab } : {} })).data,
  });

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['vendors'] });
    client.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/vendors/${id}/approve`),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/admin/vendors/${id}/reject`, { note }),
    onSuccess: () => { invalidate(); setRejectingId(null); setRejectNote(''); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/vendors/${id}/status`, { status }),
    onSuccess: invalidate,
  });

  const approveProfile = useMutation({
    mutationFn: (id: string) => api.post(`/admin/vendors/${id}/approve-profile`),
    onSuccess: invalidate,
  });

  const rejectProfile = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/admin/vendors/${id}/reject-profile`, { note }),
    onSuccess: () => { invalidate(); setProfileRejectId(null); setProfileRejectNote(''); },
  });

  const allVendors: any[] = data?.items ?? [];

  // ── State / city filter options (derived from vendors' parking locations) ──
  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    allVendors.forEach((v) =>
      (v.locations ?? []).forEach((l: any) => l?.state && set.add(l.state)),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allVendors]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    allVendors.forEach((v) =>
      (v.locations ?? []).forEach((l: any) => {
        if (!l?.city) return;
        if (stateFilter && l.state !== stateFilter) return;
        set.add(l.city);
      }),
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allVendors, stateFilter]);

  // ── Filter vendors by search text + state/city (a vendor matches if any of their spaces match) ──
  const vendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allVendors.filter((v) => {
      // Location filter — vendor matches if any of their spaces match
      const matchLocation =
        (!stateFilter && !cityFilter) ||
        (v.locations ?? []).some((l: any) => {
          if (stateFilter && l.state !== stateFilter) return false;
          if (cityFilter  && l.city  !== cityFilter)  return false;
          return true;
        });

      // Text search — business name, owner name, email, phone
      const matchSearch =
        !q ||
        (v.businessName ?? '').toLowerCase().includes(q) ||
        (v.user?.fullName ?? '').toLowerCase().includes(q) ||
        (v.user?.email ?? '').toLowerCase().includes(q) ||
        (v.user?.phone ?? '').toLowerCase().includes(q) ||
        (v.contactPhone ?? '').toLowerCase().includes(q);

      return matchLocation && matchSearch;
    });
  }, [allVendors, stateFilter, cityFilter, search]);

  const editVendorData = allVendors.find((v) => v.id === editVendorId) ?? null;
  const hasLocationFilter = stateFilter !== null || cityFilter !== null;

  // If state changes, clear city if the city isn't valid in the new state
  useEffect(() => {
    if (cityFilter && !cityOptions.includes(cityFilter)) setCityFilter(null);
  }, [cityFilter, cityOptions]);

  return (
    <>
      <section className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vendors</h1>
            <p className="mt-1 text-sm text-slate-500">Manage vendor accounts and approvals.</p>
          </div>
          <button
            onClick={() => navigate('/vendors/add')}
            className="btn-primary flex shrink-0 items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </button>
        </div>

        {/* Filters row — status tabs + state/city search */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            {VENDOR_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.value
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className="input w-full pl-8 pr-8 text-sm"
              placeholder="Search business, owner, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Spacer + searchable state/city filters */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SearchableSelect
              value={stateFilter}
              onChange={(v) => { setStateFilter(v); setCityFilter(null); }}
              options={stateOptions}
              placeholder="All states"
              icon={<MapPin className="h-3.5 w-3.5" />}
              width="w-44"
            />
            <SearchableSelect
              value={cityFilter}
              onChange={setCityFilter}
              options={cityOptions}
              placeholder={stateFilter ? 'All cities' : 'All cities'}
              emptyLabel={stateFilter ? `No cities in ${stateFilter}` : 'No cities'}
              icon={<Building2 className="h-3.5 w-3.5" />}
              width="w-44"
              disabled={cityOptions.length === 0}
            />
            {hasLocationFilter && (
              <button
                onClick={() => { setStateFilter(null); setCityFilter(null); }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Active filter summary */}
        {(hasLocationFilter || search.trim()) && (
          <p className="mt-2 text-xs text-slate-500">
            Showing {vendors.length} of {allVendors.length} vendors
            {search.trim() && ` matching “${search.trim()}”`}
            {stateFilter && ` in ${stateFilter}`}
            {cityFilter  && `, ${cityFilter}`}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <>{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</>
          ) : vendors.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">
              {search.trim()
                ? `No vendors match “${search.trim()}”.`
                : hasLocationFilter
                  ? `No vendors with spaces in ${cityFilter ?? stateFilter ?? 'this location'}.`
                  : 'No vendors found for this filter.'}
            </div>
          ) : (
            vendors.map((v: any) => {
              const isRejecting        = rejectingId === v.id;
              const isApproved         = v.status === 'APPROVED';
              const hasPendingProfile  = Boolean(v.pendingProfileData);
              const isRejectingProfile = profileRejectId === v.id;
              const pending = hasPendingProfile
                ? (JSON.parse(v.pendingProfileData) as Record<string, string>)
                : null;

              return (
                <div key={v.id} className="card overflow-hidden">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Avatar + info */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        {(v.businessName?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => navigate(`/vendors/${v.id}`)}
                            className="font-semibold text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100 dark:hover:text-brand-400"
                          >
                            {v.businessName}
                          </button>
                          <StatusBadge status={v.status} map={VENDOR_STATUS_CLS} />
                          {hasPendingProfile && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              <AlertCircle className="h-3 w-3" /> Profile edit pending
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span>{v.user?.fullName}</span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span>{v.user?.email}</span>
                          {v.contactPhone && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span>{v.contactPhone}</span>
                            </>
                          )}
                          {v.user?.phone && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span>{v.user.phone}</span>
                            </>
                          )}
                        </div>
                        {v.address && <p className="text-xs text-slate-400">{v.address}</p>}
                        {v.aadharNumber && (
                          <p className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                            Aadhar: {v.aadharNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {v.status === 'PENDING' && (
                        <>
                          <button className="btn-primary text-xs" disabled={approve.isPending}
                            onClick={() => approve.mutate(v.id)}>
                            {approve.isPending && approve.variables === v.id ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => { setRejectingId(v.id); setRejectNote(''); }}>
                            Reject
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => navigate(`/vendors/${v.id}`)}
                        className="btn-ghost text-xs"
                        title="View vendor details and spaces"
                      >
                        View
                      </button>

                      <KebabMenu>
                        <MenuItem onClick={() => setEditVendorId(v.id)}>Edit Details</MenuItem>
                        <MenuItem onClick={() => navigate(`/spaces/add?vendorId=${v.id}&vendorName=${encodeURIComponent(v.businessName ?? '')}`)}>
                          Add Parking Space
                        </MenuItem>
                        <MenuDivider />
                        <MenuItem
                          disabled={toggleStatus.isPending}
                          variant={isApproved ? 'warning' : 'default'}
                          onClick={() => toggleStatus.mutate({ id: v.id, status: isApproved ? 'INACTIVE' : 'APPROVED' })}
                        >
                          {toggleStatus.isPending && toggleStatus.variables?.id === v.id
                            ? 'Updating…' : isApproved ? 'Deactivate' : 'Activate'}
                        </MenuItem>
                      </KebabMenu>
                    </div>
                  </div>

                  {/* Vendor rejection panel */}
                  {isRejecting && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        Rejection reason (shown to vendor):
                      </p>
                      <textarea className="input w-full text-sm" rows={2}
                        placeholder="Explain why this vendor is being rejected…"
                        value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                          disabled={reject.isPending}
                          onClick={() => reject.mutate({ id: v.id, note: rejectNote })}>
                          {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
                        </button>
                        <button className="btn-ghost text-xs"
                          onClick={() => { setRejectingId(null); setRejectNote(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pending profile edit review panel */}
                  {hasPendingProfile && pending && (
                    <div className="border-t border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <AlertCircle className="h-3.5 w-3.5" /> Vendor submitted profile edits — review before approving
                      </p>
                      <div className="mb-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                        {[
                          ['Business Name',  'businessName'],
                          ['Contact Phone',  'contactPhone'],
                          ['Address',        'address'],
                          ['Aadhar Number',  'aadharNumber'],
                          ['GST Number',     'gstNumber'],
                          ['PAN Number',     'panNumber'],
                          ['Payout UPI ID',  'payoutUpiId'],
                        ].map(([label, key]) =>
                          pending[key] ? (
                            <div key={key} className="flex gap-1.5">
                              <span className="w-28 shrink-0 text-slate-400">{label}:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200 break-all">{pending[key]}</span>
                            </div>
                          ) : null,
                        )}
                        {pending.aadharDocUrl && (
                          <div className="flex gap-1.5 sm:col-span-2">
                            <span className="w-28 shrink-0 text-slate-400">Aadhar Doc:</span>
                            <a href={pending.aadharDocUrl} target="_blank" rel="noreferrer"
                              className="font-medium text-brand-600 underline dark:text-brand-400">
                              View document
                            </a>
                          </div>
                        )}
                      </div>

                      {isRejectingProfile ? (
                        <div className="space-y-2">
                          <textarea className="input w-full text-sm" rows={2}
                            placeholder="Reason for rejecting these edits (optional)…"
                            value={profileRejectNote}
                            onChange={(e) => setProfileRejectNote(e.target.value)} />
                          <div className="flex gap-2">
                            <button className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                              disabled={rejectProfile.isPending}
                              onClick={() => rejectProfile.mutate({ id: v.id, note: profileRejectNote })}>
                              {rejectProfile.isPending ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                            <button className="btn-ghost text-xs"
                              onClick={() => { setProfileRejectId(null); setProfileRejectNote(''); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="btn-primary text-xs"
                            disabled={approveProfile.isPending}
                            onClick={() => approveProfile.mutate(v.id)}>
                            {approveProfile.isPending && approveProfile.variables === v.id
                              ? 'Approving…' : 'Approve Edits'}
                          </button>
                          <button
                            className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => { setProfileRejectId(v.id); setProfileRejectNote(''); }}>
                            Reject Edits
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Edit Vendor Modal — mounts outside the card tree, no overflow/portal conflicts */}
      {editVendorData && (
        <EditVendorModal
          vendor={editVendorData}
          onClose={() => setEditVendorId(null)}
          onSaved={() => { invalidate(); setEditVendorId(null); }}
        />
      )}
    </>
  );
};

// ── Icon registry (Lucide icon name → component) ─────────────────────────────
type LucideFC = React.ComponentType<LucideProps>;

const LUCIDE_ICON_MAP: Record<string, LucideFC> = {
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Building2, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation, Car, Bike, Truck,
  // Legacy aliases so old DB values still render
  Warehouse: SquareParking,
  User: ShowerHead,
  KeyRound: ConciergeBell,
  Droplets: WashingMachine,
  Landmark: Banknote,
  Shield: ShieldCheck,
  MapPin: Navigation,
  ParkingCircle: SquareParking,
};

/** Ordered palette shown in the icon picker */
const ICON_PALETTE: { key: string; label: string }[] = [
  { key: 'Cctv',           label: 'CCTV' },
  { key: 'ShieldCheck',    label: 'Security' },
  { key: 'SquareParking',  label: 'Covered' },
  { key: 'Zap',            label: 'EV Charge' },
  { key: 'Accessibility',  label: 'Accessible' },
  { key: 'ShowerHead',     label: 'Restroom' },
  { key: 'Lightbulb',      label: 'Well Lit' },
  { key: 'ConciergeBell',  label: 'Valet' },
  { key: 'WashingMachine', label: 'Car Wash' },
  { key: 'Banknote',       label: 'ATM' },
  { key: 'Umbrella',       label: 'Shelter' },
  { key: 'BatteryCharging',label: 'Charging' },
  { key: 'Wrench',         label: 'Maintenance' },
  { key: 'Wifi',           label: 'Wi-Fi' },
  { key: 'Clock',          label: '24×7' },
  { key: 'Lock',           label: 'Secure' },
  { key: 'Camera',         label: 'Camera' },
  { key: 'Phone',          label: 'Helpdesk' },
  { key: 'Star',           label: 'Premium' },
  { key: 'Wind',           label: 'Ventilated' },
  { key: 'Fan',            label: 'Fan' },
  { key: 'Building2',      label: 'Building' },
  { key: 'Sun',            label: 'Open Air' },
  { key: 'Moon',           label: 'Overnight' },
  { key: 'Leaf',           label: 'Eco' },
  { key: 'Coffee',         label: 'Café' },
  { key: 'Waves',          label: 'Wash Bay' },
  { key: 'Flame',          label: 'Heated' },
  { key: 'Timer',          label: 'Timed' },
  { key: 'Navigation',     label: 'Directions' },
];

// ── Shared amenity icon renderer ──────────────────────────────────────────────
const AmenityIcon = ({ icon, className = 'h-5 w-5' }: { icon: string; className?: string }) => {
  if (!icon) return null;
  if (icon.startsWith('http'))
    return <img src={icon} alt="" className={`${className} rounded object-contain`} />;
  const Icon = LUCIDE_ICON_MAP[icon] as LucideFC | undefined;
  if (Icon) return <Icon className={className} />;
  return <span className="leading-none text-base">{icon}</span>;
};

// ── Icon picker grid (reused in create form and per-row edit) ─────────────────
const IconPicker = ({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) => (
  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
    {ICON_PALETTE.map(({ key, label }) => {
      const Icon = LUCIDE_ICON_MAP[key] as LucideFC;
      const active = selected === key;
      return (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onSelect(active ? '' : key)}
          className={`group relative flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
            active
              ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30'
              : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          />
          <span className="text-[9px] leading-tight text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
            {label}
          </span>
          {active && (
            <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ── Amenities page ────────────────────────────────────────────────────────────
const AmenitiesPage = () => {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [formErr, setFormErr] = useState('');
  const [changingIconId, setChangingIconId] = useState<string | null>(null);
  const [pickerIconDraft, setPickerIconDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-amenities'],
    queryFn: async () => (await api.get('/admin/amenities')).data,
  });

  const create = useMutation({
    mutationFn: (body: { name: string; description?: string; iconName: string }) =>
      api.post('/admin/amenities', body).then((r) => r.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-amenities'] });
      setName('');
      setDescription('');
      setSelectedIcon('');
      setFormErr('');
    },
    onError: (err: any) =>
      setFormErr(err?.response?.data?.message ?? 'Failed to add amenity'),
  });

  const updateIconName = useMutation({
    mutationFn: ({ id, iconName }: { id: string; iconName: string }) =>
      api.patch(`/admin/amenities/${id}`, { iconName }).then((r) => r.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-amenities'] });
      setChangingIconId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/amenities/${id}`).then((r) => r.data),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-amenities'] }),
  });

  const handleAdd = () => {
    if (!name.trim()) { setFormErr('Name is required'); return; }
    create.mutate({ name: name.trim(), description: description.trim() || undefined, iconName: selectedIcon });
  };

  const amenities: any[] = data?.items ?? [];

  return (
    <section className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Amenities</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage the amenities vendors can select when listing a parking space.
          </p>
        </div>
      </div>

      {/* ── Add form ── */}
      <div className="card mb-6 p-5">
        <p className="mb-1 text-sm font-semibold">Add New Amenity</p>

        {/* Name + description */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Name *</label>
            <input
              className="input w-full"
              placeholder="e.g. CCTV Surveillance"
              value={name}
              onChange={(e) => { setName(e.target.value); setFormErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
            <input
              className="input w-full"
              placeholder="Short description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">
              Icon{selectedIcon ? ` — ${selectedIcon}` : ' (pick one)'}
            </label>
            {selectedIcon && (
              <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 dark:border-brand-800/50 dark:bg-brand-900/20">
                <AmenityIcon icon={selectedIcon} className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{selectedIcon}</span>
              </div>
            )}
          </div>
          <IconPicker selected={selectedIcon} onSelect={setSelectedIcon} />
        </div>

        {formErr && <p className="mt-3 text-xs text-red-500">{formErr}</p>}

        <button
          type="button"
          onClick={handleAdd}
          disabled={create.isPending}
          className="btn-primary mt-4 inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {create.isPending ? 'Adding…' : 'Add Amenity'}
        </button>
      </div>

      {/* ── Amenities list ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : amenities.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-400">No amenities yet</p>
          <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Add amenities above so vendors can select them.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {amenities.map((a: any) => (
            <div key={a.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4 px-4 py-3">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <AmenityIcon icon={a.icon} className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.name}</p>
                  {a.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{a.description}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      if (changingIconId === a.id) { setChangingIconId(null); return; }
                      setChangingIconId(a.id);
                      setPickerIconDraft(a.icon);
                    }}
                  >
                    {changingIconId === a.id ? 'Cancel' : 'Change Icon'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${a.name}"? Vendors who selected it will lose it.`))
                        remove.mutate(a.id);
                    }}
                    disabled={remove.isPending}
                    className="text-slate-400 transition hover:text-red-500 disabled:opacity-50"
                    aria-label={`Delete ${a.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Inline icon picker for this row */}
              {changingIconId === a.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="mb-2 text-xs font-medium text-slate-500">Select new icon:</p>
                  <IconPicker selected={pickerIconDraft} onSelect={setPickerIconDraft} />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!pickerIconDraft || updateIconName.isPending}
                      className="btn-primary text-xs disabled:opacity-50"
                      onClick={() => updateIconName.mutate({ id: a.id, iconName: pickerIconDraft })}
                    >
                      {updateIconName.isPending ? 'Saving…' : 'Save Icon'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => setChangingIconId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Preserve the page the user was trying to reach so the login flow can
  // send them back there on success.
  const loginUrl =
    loc.pathname === '/login'
      ? '/login'
      : `/login?returnTo=${encodeURIComponent(loc.pathname + loc.search)}`;

  if (!user) return <Navigate to={loginUrl} replace />;

  if (!ADMIN_ROLES.includes(user.role)) {
    return <Navigate to={loginUrl} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <HydrateSession />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/vendors" element={<Vendors />} />
                    <Route path="/vendors/add" element={<AddVendorPage />} />
                    <Route path="/vendors/:id" element={<VendorDetailsPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                    <Route path="/customers/guest/:phone" element={<CustomerDetailsPage />} />
                    <Route path="/spaces" element={<SpacesPage />} />
                    <Route path="/slots/:id/bookings" element={<SlotBookingsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/spaces/add" element={<AddSpacePage />} />
                    <Route path="/spaces/:id" element={<SpaceDetailsPage />} />
                    <Route path="/spaces/:id/edit" element={<SpaceEditPage />} />
                    <Route path="/bookings" element={<BookingsPage />} />
                    <Route path="/commissions" element={<CommissionsPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/admins" element={<AdminsPage />} />
                    <Route path="/amenities" element={<AmenitiesPage />} />
                  </Routes>
                </AppShell>
              </AuthGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
