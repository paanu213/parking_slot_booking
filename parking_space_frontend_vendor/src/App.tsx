import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, Link, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, Layers, CalendarCheck, CircleDot, Wallet, TrendingUp, ArrowRight, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { AppShell } from '@/components/AppShell';
import { ParkingSpacesPage } from '@/pages/ParkingSpacesPage';
import { AddParkingSpacePage } from '@/pages/AddParkingSpacePage';
import { BookingsPage } from '@/pages/BookingsPage';
import { CommissionsPage } from '@/pages/CommissionsPage';
import { SlotBookingsPage } from '@/pages/SlotBookingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

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

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const BOOKING_STATUS_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING:         'bg-amber-100   text-amber-800   dark:bg-amber-900/30   dark:text-amber-300',
  PENDING_PAYMENT: 'bg-amber-100   text-amber-800   dark:bg-amber-900/30   dark:text-amber-300',
  CANCELLED:       'bg-red-100     text-red-800     dark:bg-red-900/30     dark:text-red-300',
  COMPLETED:       'bg-slate-100   text-slate-600   dark:bg-slate-800      dark:text-slate-400',
};

const Dashboard = () => {
  const { data: locData, isLoading: locLoading } = useQuery({
    queryKey: ['vendor-spaces'],
    queryFn: async () => (await api.get('/vendor/locations')).data,
  });
  const { data: bookingData, isLoading: bookingLoading } = useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: async () => (await api.get('/vendor/bookings')).data,
  });
  const { data: commission } = useQuery({
    queryKey: ['vendor-commission-summary', { period: 'month' }],
    queryFn: async () => (await api.get('/vendor/commission/summary', { params: { period: 'month' } })).data,
  });

  const locations: any[] = locData?.items ?? [];
  const bookings: any[] = bookingData?.items ?? [];
  const now = Date.now();

  // Today's window
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // Location stats
  const pendingSubmissions = locations.filter((l) => l.approvalStatus === 'PENDING_REVIEW').length;
  const approvedLocations = locations.filter((l) => l.approvalStatus === 'APPROVED');
  const allActiveSlots = approvedLocations.flatMap((l) =>
    l.slots.filter((s: any) => s.status === 'ACTIVE'),
  );
  const activeSlotIds = new Set(allActiveSlots.map((s: any) => s.id));

  // Reserved = CONFIRMED bookings whose window covers right now
  const reservedSlotIds = new Set(
    bookings
      .filter(
        (b) =>
          b.status === 'CONFIRMED' &&
          new Date(b.startAt).getTime() <= now &&
          new Date(b.endAt).getTime() >= now,
      )
      .map((b) => b.slot?.id)
      .filter((id: string | undefined) => id && activeSlotIds.has(id)),
  );

  const totalActive   = allActiveSlots.length;
  const totalReserved = reservedSlotIds.size;
  const totalFree     = totalActive - totalReserved;

  // Booking revenue stats
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');
  const revenue = confirmedBookings.reduce((sum: number, b: any) => sum + Number(b.totalAmount), 0);

  // Today's stats
  const todayBookings = bookings.filter((b) => {
    const t = new Date(b.createdAt).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });
  const todayRevenue = todayBookings
    .filter((b) => b.status === 'CONFIRMED')
    .reduce((sum: number, b: any) => sum + Number(b.totalAmount), 0);

  // Recent bookings (last 5)
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const loading = locLoading || bookingLoading;

  return (
    <section className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Submissions & slots */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Parking Spaces</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            loading={loading}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="Pending Approval"
            value={pendingSubmissions}
            sub="awaiting admin review"
            accent="amber"
            linkTo="/spaces"
          />
          <StatCard
            loading={loading}
            icon={<Layers className="h-4 w-4 text-brand-500" />}
            label="Active Slots"
            value={totalActive}
            sub={`across ${approvedLocations.length} approved location${approvedLocations.length !== 1 ? 's' : ''}`}
            accent="brand"
          />
          <StatCard
            loading={loading}
            icon={<CircleDot className="h-4 w-4 text-red-500" />}
            label="Currently Reserved"
            value={totalReserved}
            sub="slots occupied right now"
            accent="red"
          />
          <StatCard
            loading={loading}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            label="Currently Free"
            value={totalFree}
            sub="slots available right now"
            accent="emerald"
          />
        </div>
      </div>

      {/* Booking revenue */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bookings</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            loading={loading}
            icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />}
            label="Confirmed Bookings"
            value={confirmedBookings.length}
            sub="all time"
            accent="emerald"
            linkTo="/bookings"
          />
          <StatCard
            loading={loading}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="Pending Payment"
            value={bookings.filter((b) => b.status === 'PENDING_PAYMENT').length}
            sub="awaiting payment"
            accent="amber"
          />
          <StatCard
            loading={loading}
            icon={<Wallet className="h-4 w-4 text-brand-500" />}
            label="Total Revenue"
            value={`₹${revenue.toLocaleString('en-IN')}`}
            sub="from confirmed bookings"
            accent="brand"
          />
          <StatCard
            loading={loading}
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Today's Earnings"
            value={`₹${todayRevenue.toLocaleString('en-IN')}`}
            sub={`${todayBookings.length} booking${todayBookings.length !== 1 ? 's' : ''} today`}
            accent="emerald"
          />
        </div>
      </div>

      {/* Commission (this month) */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Commission Payable · This Month</h2>
          <Link to="/commissions" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400">
            View details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            loading={loading}
            icon={<Percent className="h-4 w-4 text-amber-500" />}
            label="Total Commission"
            value={`₹${Number(commission?.totalCommission ?? 0).toLocaleString('en-IN')}`}
            sub={`at ${commission?.rate ?? '—'}% rate`}
            accent="amber"
            linkTo="/commissions"
          />
          <StatCard
            loading={loading}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            label="Paid"
            value={`₹${Number(commission?.paidCommission ?? 0).toLocaleString('en-IN')}`}
            sub="settled with company"
            accent="emerald"
          />
          <StatCard
            loading={loading}
            icon={<Clock className="h-4 w-4 text-red-500" />}
            label="Pending"
            value={`₹${Number(commission?.pendingCommission ?? 0).toLocaleString('en-IN')}`}
            sub="to be paid"
            accent="red"
          />
        </div>
      </div>

      {/* Recent bookings */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-brand-500" />
            <p className="text-sm font-semibold">Recent Bookings</p>
          </div>
          <Link to="/bookings" className="flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest / Customer</th>
                  <th>Space · Slot</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      <p className="text-sm font-medium">
                        {b.isDirectBooking ? (b.guestName ?? 'Walk-in Guest') : (b.user?.fullName ?? '—')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {b.isDirectBooking ? (b.guestPhone ?? 'Direct') : (b.user?.email ?? '')}
                      </p>
                    </td>
                    <td className="text-sm">
                      {b.slot?.location?.name ?? '—'}
                      <span className="ml-1 font-mono text-xs text-slate-400">· {b.slot?.code}</span>
                    </td>
                    <td className="text-xs text-slate-500">{fmtDate(b.startAt)}</td>
                    <td className="font-semibold">₹{Number(b.totalAmount).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {b.status}
                      </span>
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
};

const StatCard = ({
  loading,
  icon,
  label,
  value,
  sub,
  accent,
  linkTo,
}: {
  loading: boolean;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  accent: string;
  linkTo?: string;
}) => {
  const content = (
    <div className={`card p-4 transition ${linkTo ? 'hover:shadow-md cursor-pointer' : ''}`}>
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-7 w-1/3" />
          <div className="skeleton h-3 w-2/3" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-medium text-slate-500">{label}</span>
          </div>
          <div className="mt-2 text-2xl font-bold">{value}</div>
          <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
        </>
      )}
    </div>
  );
  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
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
  if (user.role !== 'VENDOR') {
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
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/spaces" element={<ParkingSpacesPage />} />
                    <Route path="/spaces/add" element={<AddParkingSpacePage />} />
                    <Route path="/slots/:id/bookings" element={<SlotBookingsPage />} />
                    <Route path="/bookings" element={<BookingsPage />} />
                    <Route path="/commissions" element={<CommissionsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
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
