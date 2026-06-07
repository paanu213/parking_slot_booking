import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, MapPin, Layers, CalendarCheck, IndianRupee,
  Percent, CheckCircle2, Clock, Pencil, Hash, Navigation, Sparkles,
  User, Phone, Mail, Store,
} from 'lucide-react';
import { api } from '@/lib/api';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

const fmtINR = (n?: number | null) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

const APPROVAL_CLS: Record<string, string> = {
  APPROVED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING_REVIEW: 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  REJECTED:       'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
};

const BOOKING_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING_PAYMENT: 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  CANCELLED:       'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  COMPLETED:       'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
  FAILED:          'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
};

export default function SpaceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['space-details', id],
    queryFn: async () => (await api.get(`/admin/spaces/${id}/details`)).data,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <section className="space-y-4 p-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-60 w-full" />
      </section>
    );
  }

  if (error || !data?.space) {
    return (
      <section className="p-6">
        <button
          onClick={() => navigate('/spaces')}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Spaces
        </button>
        <div className="card p-10 text-center text-sm text-red-500">Space not found.</div>
      </section>
    );
  }

  const s: any           = data.space;
  const stats            = data.stats ?? {};
  const bookings: any[]  = data.bookings ?? [];
  const vendor: any      = s.vendor ?? {};
  const slots: any[]     = s.slots ?? [];
  const amenities: any[] = s.amenities ?? [];
  const statusCls        = APPROVAL_CLS[s.approvalStatus] ?? APPROVAL_CLS.PENDING_REVIEW;

  return (
    <section className="space-y-5 p-6">
      {/* ── Top bar ── */}
      <div>
        <button
          onClick={() => navigate('/spaces')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Spaces
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{s.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                {s.approvalStatus === 'PENDING_REVIEW' ? 'Under Review' : s.approvalStatus}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                s.isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {s.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Added {fmtDate(s.createdAt)} · Space ID <span className="font-mono">{s.id}</span>
            </p>
          </div>

          <button
            onClick={() => navigate(`/spaces/${s.id}/edit`)}
            className="btn-primary flex shrink-0 items-center gap-1.5 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Space
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Layers className="h-4 w-4 text-indigo-500" />} label="Slots" value={stats.slots ?? slots.length} />
        <StatTile icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />} label="Confirmed Bookings"
                  value={stats.bookingsConfirmed ?? 0} sub={`${stats.bookingsTotal ?? 0} total`} />
        <StatTile icon={<IndianRupee className="h-4 w-4 text-amber-500" />} label="Revenue" value={fmtINR(stats.revenue)} />
        <StatTile icon={<Percent className="h-4 w-4 text-amber-500" />} label="Commission Owed"
                  value={fmtINR(stats.commissionTotal)} sub={`${fmtINR(stats.commissionPending)} pending`} />
      </div>

      {/* ── Commission ── */}
      <div className="card border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
        <div className="mb-3 flex items-center gap-2">
          <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold">Commission on this Space</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={<Percent className="h-4 w-4 text-amber-500" />} label="Total Commission" value={fmtINR(stats.commissionTotal)} />
          <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Received" value={fmtINR(stats.commissionPaid)} />
          <StatTile icon={<Clock className="h-4 w-4 text-red-500" />} label="Pending Collection" value={fmtINR(stats.commissionPending)} />
        </div>
      </div>

      {/* ── Space + vendor details ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Space Details</h2>
          <dl className="space-y-2 text-sm">
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={s.name} />
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={s.addressLine} multi />
            <DetailRow icon={<Navigation className="h-3.5 w-3.5" />} label="Landmark" value={s.landmark} multi />
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Area" value={s.area} />
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="City / State" value={[s.city, s.state].filter(Boolean).join(', ')} />
            <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Pincode" value={s.pincode} mono />
            <DetailRow icon={<Navigation className="h-3.5 w-3.5" />} label="Latitude" value={s.latitude != null ? Number(s.latitude).toFixed(6) : null} mono />
            <DetailRow icon={<Navigation className="h-3.5 w-3.5" />} label="Longitude" value={s.longitude != null ? Number(s.longitude).toFixed(6) : null} mono />
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Description" value={s.description} multi />
            {amenities.length > 0 && (
              <DetailRow
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="Amenities"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {amenities.map((a) => (
                      <span key={a.amenity?.id ?? a.amenityId}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {a.amenity?.icon} {a.amenity?.name}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
          </dl>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Vendor</h2>
            {vendor.id && (
              <button
                onClick={() => navigate(`/vendors/${vendor.id}`)}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
              >
                <Store className="h-3 w-3" /> View vendor
              </button>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Business" value={vendor.businessName} />
            <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Owner" value={vendor.user?.fullName} />
            <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={vendor.user?.email} />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={vendor.contactPhone ?? vendor.user?.phone} />
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Vendor address" value={vendor.address} multi />
            <DetailRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Vendor status" value={vendor.status} />
          </dl>
        </div>
      </div>

      {/* ── Slots ── */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Slots <span className="text-slate-400">({slots.length})</span></h2>
        </div>
        {slots.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No slots on this space.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Code</th><th>Vehicle</th><th>Hourly</th><th>Monthly</th><th>Status</th></tr>
              </thead>
              <tbody>
                {slots.map((sl) => (
                  <tr key={sl.id}>
                    <td className="font-medium">{sl.code}</td>
                    <td className="text-sm text-slate-500">{sl.vehicleType}</td>
                    <td>{fmtINR(Number(sl.hourlyPrice))}/hr</td>
                    <td>{sl.monthlyPrice != null ? `${fmtINR(Number(sl.monthlyPrice))}/mo` : '—'}</td>
                    <td className="text-sm">{sl.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Booking history ── */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            Booking History <span className="text-slate-400">({bookings.length} most recent)</span>
          </h2>
        </div>
        {bookings.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No bookings on this space yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th><th>Customer</th><th>Slot</th><th>Period</th>
                  <th>Amount</th><th>Commission</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">{b.reference}</td>
                    <td className="text-sm">
                      <p className="font-medium">{b.user?.fullName ?? b.guestName ?? 'Walk-in Guest'}</p>
                      {(b.user?.phone ?? b.guestPhone) && (
                        <p className="text-xs text-slate-400">{b.user?.phone ?? b.guestPhone}</p>
                      )}
                    </td>
                    <td className="text-sm">{b.slot?.code}</td>
                    <td className="text-xs text-slate-500">
                      {fmtDateTime(b.startAt)}<br />→ {fmtDateTime(b.endAt)}
                    </td>
                    <td className="font-semibold">{fmtINR(Number(b.totalAmount))}</td>
                    <td className="text-sm">{fmtINR(Number(b.commissionAmount))}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_CLS[b.status] ?? ''}`}>
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
}

const StatTile = ({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
    <div className="mt-1 text-xl font-bold">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
  </div>
);

const DetailRow = ({
  icon, label, value, mono, multi,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  multi?: boolean;
}) => {
  if (value == null || value === '') return null;
  return (
    <div className={`flex ${multi ? 'items-start' : 'items-center'} gap-2`}>
      <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-slate-400">
        {icon} {label}
      </span>
      <span className={`min-w-0 flex-1 break-words text-slate-700 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
};
