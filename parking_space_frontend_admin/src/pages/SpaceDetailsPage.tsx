import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, MapPin, Layers, CalendarCheck, IndianRupee,
  Percent, CheckCircle2, XCircle, Clock, Pencil, Hash, Navigation, Sparkles,
  User, Phone, Mail, Store, ImageIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PendingChanges } from '@/components/PendingChanges';

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

  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['space-details', id],
    queryFn: async () => (await api.get(`/admin/spaces/${id}/details`)).data,
    enabled: Boolean(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['space-details', id] });
    qc.invalidateQueries({ queryKey: ['admin-spaces'] });
  };
  const approve = useMutation({
    mutationFn: () => api.post(`/admin/spaces/${id}/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admin/spaces/${id}/reject`, { note: rejectNote || undefined }),
    onSuccess: () => { invalidate(); setRejecting(false); setRejectNote(''); },
  });

  // ── Pending vendor edits (approve / reject the requested changes) ──
  const [rejectingEdits, setRejectingEdits] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const approveChanges = useMutation({
    mutationFn: () => api.post(`/admin/spaces/${id}/approve`),
    onSuccess: () => { invalidate(); setFlash('Vendor changes approved and applied to the live space.'); },
  });
  const rejectEdits = useMutation({
    mutationFn: () => api.post(`/admin/spaces/${id}/reject-edits`, { note: editNote || undefined }),
    onSuccess: () => { invalidate(); setRejectingEdits(false); setEditNote(''); setFlash('Vendor changes rejected — the space keeps its current values.'); },
  });

  // Add a slot directly (admin action — no approval step).
  const [newSlot, setNewSlot] = useState({ code: '', vehicleType: 'FOUR_WHEELER', hourlyPrice: '', monthlyPrice: '' });
  const addSlot = useMutation({
    mutationFn: () => {
      const mp = newSlot.monthlyPrice.trim();
      return api.post(`/admin/locations/${id}/slots`, {
        code:        newSlot.code.trim(),
        vehicleType: newSlot.vehicleType,
        hourlyPrice: Number(newSlot.hourlyPrice),
        ...(mp !== '' && Number(mp) > 0 ? { monthlyPrice: Number(mp) } : {}),
      });
    },
    onSuccess: () => {
      invalidate();
      setNewSlot({ code: '', vehicleType: 'FOUR_WHEELER', hourlyPrice: '', monthlyPrice: '' });
    },
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
  const images: any[]    = s.images ?? [];
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

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {s.approvalStatus === 'PENDING_REVIEW' && (
              <>
                <button
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {approve.isPending ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => setRejecting((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </>
            )}
            <button
              onClick={() => navigate(`/spaces/${s.id}/edit`)}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Space
            </button>
          </div>
        </div>

        {/* Reject reason (pending spaces) */}
        {rejecting && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-900/20">
            <label className="mb-1 block text-xs font-medium text-red-700 dark:text-red-300">
              Reason for rejection (shown to the vendor)
            </label>
            <textarea
              className="input w-full text-sm"
              rows={2}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Images unclear, address mismatch…"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {reject.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button onClick={() => { setRejecting(false); setRejectNote(''); }} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Success confirmation after approving/rejecting changes ── */}
      {flash && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {flash}</span>
          <button onClick={() => setFlash(null)} className="text-xs font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* ── Pending vendor edits — current vs requested + approve/reject ── */}
      {s.pendingData && (
        <div className="card overflow-hidden">
          <PendingChanges space={s} />
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            {rejectingEdits ? (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500">
                  Reason for rejecting these changes (optional — shown to the vendor)
                </label>
                <textarea
                  className="input w-full text-sm"
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Area mismatch, name not permitted…"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => rejectEdits.mutate()}
                    disabled={rejectEdits.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {rejectEdits.isPending ? 'Rejecting…' : 'Confirm Reject Changes'}
                  </button>
                  <button onClick={() => { setRejectingEdits(false); setEditNote(''); }} className="btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => approveChanges.mutate()}
                  disabled={approveChanges.isPending}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {approveChanges.isPending ? 'Approving…' : 'Approve Changes'}
                </button>
                <button
                  onClick={() => setRejectingEdits(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject Changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* ── Images ── */}
      <div className="card">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <ImageIcon className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold">Photos <span className="text-slate-400">({images.length})</span></h2>
        </div>
        {images.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No photos uploaded for this space.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <a key={img.id} href={img.url} target="_blank" rel="noreferrer"
                 className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <img src={img.url} alt="" loading="lazy"
                     className="h-full w-full object-cover transition group-hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Slots ── */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Slots <span className="text-slate-400">({slots.length})</span></h2>
        </div>
        {slots.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No slots on this space yet.</div>
        ) : (
          <div className="space-y-2 p-4">
            {slots.map((sl) => (
              <SlotManageRow key={sl.id} slot={sl} spaceId={String(id)} />
            ))}
          </div>
        )}

        {/* Add a slot directly (no approval needed) */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Add New Slot</p>
          <div className="grid gap-2 sm:grid-cols-5">
            <input className="input text-sm" placeholder="Code (A1)" value={newSlot.code}
                   onChange={(e) => setNewSlot((s) => ({ ...s, code: e.target.value }))} />
            <select className="input text-sm" value={newSlot.vehicleType}
                    onChange={(e) => setNewSlot((s) => ({ ...s, vehicleType: e.target.value }))}>
              <option value="TWO_WHEELER">2-Wheeler</option>
              <option value="FOUR_WHEELER">4-Wheeler</option>
              <option value="HEAVY">Heavy</option>
            </select>
            <input className="input text-sm" type="number" min="0" placeholder="Hourly ₹" value={newSlot.hourlyPrice}
                   onChange={(e) => setNewSlot((s) => ({ ...s, hourlyPrice: e.target.value }))} />
            <input className="input text-sm" type="number" min="0" placeholder="Monthly ₹ (optional)" value={newSlot.monthlyPrice}
                   onChange={(e) => setNewSlot((s) => ({ ...s, monthlyPrice: e.target.value }))} />
            <button className="btn-primary text-sm"
                    disabled={addSlot.isPending || !newSlot.code.trim() || newSlot.hourlyPrice.trim() === ''}
                    onClick={() => addSlot.mutate()}>
              {addSlot.isPending ? 'Adding…' : '+ Add Slot'}
            </button>
          </div>
          {addSlot.isError && <p className="mt-1 text-xs text-red-500">Could not add slot. Check the code isn’t a duplicate.</p>}
          <p className="mt-1 text-[10px] text-slate-400">
            Added directly — no separate approval. Monthly = 30-day pass; leave blank to disable monthly bookings.
          </p>
        </div>
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
                  <th>Reference</th><th>Booked On</th><th>Customer</th><th>Slot</th><th>Period</th>
                  <th>Amount</th><th>Commission</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">{b.reference}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(b.createdAt)}</td>
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

const VT_LABELS: Record<string, string> = { TWO_WHEELER: '2-Wheeler', FOUR_WHEELER: '4-Wheeler', HEAVY: 'Heavy' };

// Editable slot row for the space details page (edit + activate/deactivate).
const SlotManageRow = ({ slot, spaceId }: { slot: any; spaceId: string }) => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['space-details', spaceId] });
  const [editing, setEditing]         = useState(false);
  const [code, setCode]               = useState(slot.code);
  const [vehicleType, setVehicleType] = useState(slot.vehicleType === 'CAR' ? 'FOUR_WHEELER' : slot.vehicleType);
  const [hourly, setHourly]           = useState(String(slot.hourlyPrice));
  const [monthly, setMonthly]         = useState(slot.monthlyPrice != null ? String(slot.monthlyPrice) : '');

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/slots/${slot.id}`, {
      code: code.trim(), vehicleType,
      hourlyPrice: Number(hourly),
      monthlyPrice: monthly.trim() === '' ? null : Number(monthly),
    }),
    onSuccess: () => { invalidate(); setEditing(false); },
  });
  const toggle = useMutation({
    mutationFn: () => api.patch(`/admin/slots/${slot.id}/status`, { status: slot.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: invalidate,
  });

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <span className="font-mono text-sm font-semibold">{slot.code}</span>
          <span className="ml-2 text-xs text-slate-400">
            {VT_LABELS[slot.vehicleType] ?? slot.vehicleType} · {fmtINR(Number(slot.hourlyPrice))}/hr
            {slot.monthlyPrice != null && Number(slot.monthlyPrice) > 0 && <> · {fmtINR(Number(slot.monthlyPrice))}/mo</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            slot.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>{slot.status}</span>
          <button onClick={() => toggle.mutate()} disabled={toggle.isPending} className="btn-ghost text-xs">
            {slot.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => setEditing((e) => !e)} className="btn-ghost inline-flex items-center gap-1 text-xs">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
      </div>
      {editing && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="grid gap-2 sm:grid-cols-4">
            <input className="input text-sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" />
            <select className="input text-sm" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="TWO_WHEELER">2-Wheeler</option>
              <option value="FOUR_WHEELER">4-Wheeler</option>
              <option value="HEAVY">Heavy</option>
            </select>
            <input className="input text-sm" type="number" min="0" value={hourly} onChange={(e) => setHourly(e.target.value)} placeholder="Hourly ₹" />
            <input className="input text-sm" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Monthly ₹ (optional)" />
          </div>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary text-xs" disabled={save.isPending || !code.trim() || hourly.trim() === ''} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost text-xs" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

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
