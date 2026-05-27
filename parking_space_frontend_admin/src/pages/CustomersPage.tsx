import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserRound, ToggleLeft, ToggleRight,
  CalendarCheck, Car, MapPin, ArrowUpDown, Pencil, X, Save,
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

// ── Edit Customer Modal ──────────────────────────────────────────────────────
type EditTarget =
  | { kind: 'registered'; data: RegisteredCustomer }
  | { kind: 'guest';      data: GuestCustomer };

const EditCustomerModal = ({
  target, onClose, onSaved,
}: {
  target:  EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const qc = useQueryClient();
  const isReg = target.kind === 'registered';

  // Initial form values depend on the row kind
  const [form, setForm] = useState(() =>
    isReg
      ? {
          fullName: (target.data as RegisteredCustomer).fullName ?? '',
          email:    (target.data as RegisteredCustomer).email    ?? '',
          phone:    (target.data as RegisteredCustomer).phone    ?? '',
        }
      : {
          guestName:          (target.data as GuestCustomer).name          ?? '',
          guestPhone:         (target.data as GuestCustomer).phone         ?? '',
          guestVehicleNumber: (target.data as GuestCustomer).vehicleNumber ?? '',
          guestVehicleModel:  (target.data as GuestCustomer).vehicleModel  ?? '',
        },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: async () => {
      if (isReg) {
        const reg = target.data as RegisteredCustomer;
        const payload: Record<string, unknown> = {
          fullName: (form as any).fullName?.trim(),
          email:    (form as any).email?.trim(),
          phone:    (form as any).phone?.trim() || null,
        };
        return (await api.patch(`/admin/customers/${reg.id}`, payload)).data;
      } else {
        const g = target.data as GuestCustomer;
        const payload: Record<string, unknown> = {
          currentPhone:       g.phone,
          guestName:          (form as any).guestName?.trim(),
          guestPhone:         (form as any).guestPhone?.trim(),
          guestVehicleNumber: (form as any).guestVehicleNumber?.trim() || null,
          guestVehicleModel:  (form as any).guestVehicleModel?.trim()  || null,
        };
        return (await api.patch(`/admin/customers/guest`, payload)).data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      onSaved();
      onClose();
    },
  });

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val } as any));

  const errorMsg =
    (save.error as any)?.response?.data?.error?.message ??
    (save.error as any)?.response?.data?.message ??
    (save.isError ? 'Failed to save changes' : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <Pencil className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                Edit {isReg ? 'Registered Customer' : 'Walk-in Guest'}
              </h2>
              <p className="text-xs text-slate-500">
                {isReg
                  ? 'Update the customer\'s account details.'
                  : 'Updates apply to all of this guest\'s past direct bookings.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          {isReg ? (
            <>
              <Field label="Full Name *">
                <input
                  className="input w-full"
                  value={(form as any).fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  className="input w-full"
                  value={(form as any).email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input w-full"
                  placeholder="Optional"
                  value={(form as any).phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Guest Name *">
                <input
                  className="input w-full"
                  value={(form as any).guestName}
                  onChange={(e) => set('guestName', e.target.value)}
                />
              </Field>
              <Field label="Phone *">
                <input
                  className="input w-full"
                  value={(form as any).guestPhone}
                  onChange={(e) => set('guestPhone', e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle Number">
                  <input
                    className="input w-full"
                    placeholder="e.g. TS09AB1234"
                    value={(form as any).guestVehicleNumber}
                    onChange={(e) => set('guestVehicleNumber', e.target.value)}
                  />
                </Field>
                <Field label="Vehicle Model">
                  <input
                    className="input w-full"
                    placeholder="e.g. Honda City"
                    value={(form as any).guestVehicleModel}
                    onChange={(e) => set('guestVehicleModel', e.target.value)}
                  />
                </Field>
              </div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                Changes apply to every direct booking that currently has this guest's phone number ({(target.data as GuestCustomer).phone}).
              </p>
            </>
          )}

          {errorMsg && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {errorMsg}
            </p>
          )}

          <div className="mt-1 flex gap-3">
            <button type="button" onClick={onClose} disabled={save.isPending} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
    {children}
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
export const CustomersPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [search,    setSearch]    = useState('');
  const [apiSearch, setApiSearch] = useState('');
  const [filter,    setFilter]    = useState<CustomerFilter>('ALL');
  const [sort,      setSort]      = useState<SortKey>('newest');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

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
                          <button
                            onClick={() => navigate(`/customers/${c.id}?name=${encodeURIComponent(c.fullName ?? '')}`)}
                            className="flex items-center gap-3 text-left transition group"
                            title="View customer details"
                          >
                            <Avatar name={c.fullName} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-400">
                                {c.fullName || '—'}
                              </p>
                              <p className="text-xs text-slate-400">{c.email}</p>
                            </div>
                          </button>
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
                        {/* Actions: edit + status toggle */}
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditTarget({ kind: 'registered', data: c })}
                              title="Edit customer details"
                              className="text-slate-400 transition hover:text-violet-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
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
                          </div>
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
                        <button
                          onClick={() => navigate(`/customers/guest/${encodeURIComponent(g.phone)}?name=${encodeURIComponent(g.name ?? '')}`)}
                          className="flex items-center gap-3 text-left transition group"
                          title="View guest details and booking history"
                        >
                          <Avatar name={g.name} guest />
                          <div className="min-w-0">
                            <p className="text-sm font-medium group-hover:text-brand-600 group-hover:underline dark:group-hover:text-brand-400">
                              {g.name || '—'}
                            </p>
                          </div>
                        </button>
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
                      {/* Edit action */}
                      <td>
                        <button
                          onClick={() => setEditTarget({ kind: 'guest', data: g })}
                          title="Edit guest details (applies to all their bookings)"
                          className="text-slate-400 transition hover:text-violet-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit customer modal */}
      {editTarget && (
        <EditCustomerModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setEditTarget(null)}
        />
      )}
    </section>
  );
};
