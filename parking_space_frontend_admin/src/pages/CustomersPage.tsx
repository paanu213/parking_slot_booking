import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserRound, ToggleLeft, ToggleRight,
  CalendarCheck, Car, MapPin, ArrowUpDown,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RegisteredCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  _count: { bookings: number };
}

interface GuestCustomer {
  phone: string;
  name: string;
  vehicleNumber: string | null;
  vehicleModel: string | null;
  bookingCount: number;
  lastSeen: string;
  locations: string[];
}

// ── Filter types ───────────────────────────────────────────────────────────────
type CustomerFilter = 'ALL' | 'GUESTS' | 'REGISTERED';
type SortKey        = 'newest' | 'oldest' | 'most_bookings' | 'fewest_bookings' | 'name_az';

const FILTER_OPTIONS: { key: CustomerFilter; label: string }[] = [
  { key: 'ALL',        label: 'All' },
  { key: 'GUESTS',     label: 'Walk-in Guests' },
  { key: 'REGISTERED', label: 'Registered Accounts' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',          label: 'Newest first' },
  { key: 'oldest',          label: 'Oldest first' },
  { key: 'most_bookings',   label: 'Most bookings / visits' },
  { key: 'fewest_bookings', label: 'Fewest bookings / visits' },
  { key: 'name_az',         label: 'Name A–Z' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CLS = {
  ACTIVE:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  INACTIVE: 'bg-slate-100   text-slate-600   dark:bg-slate-800       dark:text-slate-400',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

let _debounceTimer: ReturnType<typeof setTimeout>;
const debounce = (fn: () => void, ms: number) => {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(fn, ms);
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Avatar = ({ name, guest }: { name: string; guest?: boolean }) => (
  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
    guest
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
  }`}>
    {(name?.[0] ?? '?').toUpperCase()}
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
export const CustomersPage = () => {
  const qc = useQueryClient();

  const [search,    setSearch]    = useState('');
  const [apiSearch, setApiSearch] = useState('');
  const [filter,    setFilter]    = useState<CustomerFilter>('ALL');
  const [sort,      setSort]      = useState<SortKey>('newest');

  const handleSearch = (val: string) => {
    setSearch(val);
    debounce(() => setApiSearch(val), 400);
  };

  // ── Data ──
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', apiSearch],
    queryFn: async () =>
      (await api.get('/admin/customers', {
        params: apiSearch ? { search: apiSearch } : {},
      })).data as { registered: RegisteredCustomer[]; guests: GuestCustomer[] },
  });

  const toggleStatus = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/customers/${id}/status`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  const allRegistered: RegisteredCustomer[] = data?.registered ?? [];
  const allGuests: GuestCustomer[]          = data?.guests ?? [];

  // ── Unified row type ──────────────────────────────────────────────────────────
  type Row =
    | { kind: 'registered'; data: RegisteredCustomer; sortDate: number; sortBookings: number; sortName: string }
    | { kind: 'guest';      data: GuestCustomer;      sortDate: number; sortBookings: number; sortName: string };

  // ── Build merged + filtered + sorted list ──
  const rows = useMemo<Row[]>(() => {
    const regRows: Row[] = allRegistered.map((c) => ({
      kind:         'registered',
      data:         c,
      sortDate:     new Date(c.createdAt).getTime(),
      sortBookings: c._count.bookings,
      sortName:     (c.fullName ?? '').toLowerCase(),
    }));

    const guestRows: Row[] = allGuests.map((g) => ({
      kind:         'guest',
      data:         g,
      sortDate:     new Date(g.lastSeen).getTime(),
      sortBookings: g.bookingCount,
      sortName:     (g.name ?? '').toLowerCase(),
    }));

    let list: Row[] =
      filter === 'REGISTERED' ? regRows :
      filter === 'GUESTS'     ? guestRows :
      [...regRows, ...guestRows];

    switch (sort) {
      case 'newest':          list.sort((a, b) => b.sortDate     - a.sortDate);     break;
      case 'oldest':          list.sort((a, b) => a.sortDate     - b.sortDate);     break;
      case 'most_bookings':   list.sort((a, b) => b.sortBookings - a.sortBookings); break;
      case 'fewest_bookings': list.sort((a, b) => a.sortBookings - b.sortBookings); break;
      case 'name_az':         list.sort((a, b) => a.sortName.localeCompare(b.sortName)); break;
    }

    return list;
  }, [allRegistered, allGuests, filter, sort]);

  // ── Per-filter counts for pill badges ──
  const counts: Record<CustomerFilter, number> = useMemo(() => ({
    ALL:        allRegistered.length + allGuests.length,
    REGISTERED: allRegistered.length,
    GUESTS:     allGuests.length,
  }), [allRegistered, allGuests]);

  // ── Empty state ──
  const EmptyState = () => (
    <div className="card flex flex-col items-center gap-3 py-16 text-center">
      <UserRound className="h-10 w-10 text-slate-300" />
      <p className="text-sm font-medium text-slate-400">
        {apiSearch ? 'No customers match your search.' : 'No customers yet.'}
      </p>
      <p className="text-xs text-slate-300 dark:text-slate-600">
        Registered accounts and walk-in guests appear here.
      </p>
    </div>
  );

  return (
    <section className="space-y-4 p-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registered accounts and walk-in guests across all vendors.
          </p>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            className="w-52 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Search name, phone, email, vehicle…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar + sort ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter pills */}
        <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                filter === f.key
                  ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {f.label}
              {!isLoading && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  filter === f.key
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-xs font-medium text-slate-600 outline-none dark:text-slate-300"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-xs text-slate-400">
          Showing{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-300">{rows.length}</span>
          {rows.length !== counts[filter] && (
            <> of <span className="font-semibold text-slate-600 dark:text-slate-300">{counts[filter]}</span></>
          )}
          {' '}customer{counts[filter] !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th>Bookings</th>
                  <th>Spaces visited</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.kind === 'registered') {
                    const c = row.data;
                    return (
                      <tr key={`reg-${c.id}`}>
                        {/* Customer */}
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.fullName} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{c.fullName || '—'}</p>
                              <p className="text-xs text-slate-400">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Type */}
                        <td>
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                            Registered
                          </span>
                        </td>
                        {/* Phone */}
                        <td className="text-sm text-slate-500">{c.phone ?? '—'}</td>
                        {/* Vehicle — N/A for registered */}
                        <td><span className="text-xs text-slate-300">—</span></td>
                        {/* Bookings */}
                        <td>
                          <div className="flex items-center gap-1.5">
                            <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm font-semibold">{c._count.bookings}</span>
                          </div>
                        </td>
                        {/* Spaces visited — N/A */}
                        <td><span className="text-xs text-slate-300">—</span></td>
                        {/* Date */}
                        <td className="text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                        {/* Status */}
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[c.status]}`}>
                            {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {/* Toggle */}
                        <td>
                          <button
                            onClick={() => {
                              if (confirm(`${c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} account for ${c.fullName}?`))
                                toggleStatus.mutate(c.id);
                            }}
                            disabled={toggleStatus.isPending}
                            title={c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            className="text-slate-400 transition hover:text-brand-600 disabled:opacity-50"
                          >
                            {c.status === 'ACTIVE'
                              ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                              : <ToggleLeft className="h-5 w-5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // guest row
                  const g = row.data;
                  return (
                    <tr key={`guest-${g.phone}`}>
                      {/* Customer */}
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={g.name} guest />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{g.name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      {/* Type */}
                      <td>
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                          Walk-in
                        </span>
                      </td>
                      {/* Phone */}
                      <td className="text-sm text-slate-500">{g.phone}</td>
                      {/* Vehicle */}
                      <td>
                        {g.vehicleNumber ? (
                          <div className="flex items-center gap-1.5">
                            <Car className="h-3.5 w-3.5 text-slate-400" />
                            <div>
                              <p className="font-mono text-xs font-semibold">{g.vehicleNumber}</p>
                              {g.vehicleModel && (
                                <p className="text-xs text-slate-400">{g.vehicleModel}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {/* Bookings / visits */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm font-semibold">{g.bookingCount}</span>
                          <span className="text-xs text-slate-400">
                            {g.bookingCount === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>
                      </td>
                      {/* Spaces visited */}
                      <td>
                        {g.locations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.locations.slice(0, 2).map((loc) => (
                              <span key={loc} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                <MapPin className="h-3 w-3" />
                                {loc}
                              </span>
                            ))}
                            {g.locations.length > 2 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                                +{g.locations.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {/* Last seen */}
                      <td className="text-xs text-slate-500">{fmtDate(g.lastSeen)}</td>
                      {/* Status — guests have no account status */}
                      <td><span className="text-xs text-slate-300">—</span></td>
                      {/* No toggle for guests */}
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
