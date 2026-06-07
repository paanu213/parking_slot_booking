import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, ShieldCheck,
  Calendar, CalendarCheck, IndianRupee, Layers, Plus,
  CheckCircle2, Clock, XCircle, Pencil, ChevronDown, ChevronUp,
  Bike, Car, Truck, ToggleLeft, ToggleRight, Sparkles, Save, X, Percent,
  UserPlus, Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';
import { EditSpaceSlideOver } from '@/components/EditSpaceSlideOver';
import { AmenityIcon } from '@/components/AmenityIcon';

// ── Constants ────────────────────────────────────────────────────────────────
const VENDOR_STATUS_CLS: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  INACTIVE: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const SPACE_STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    Icon: Clock,
  },
  APPROVED: {
    label: 'Approved',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Rejected',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    Icon: XCircle,
  },
};

const VT_MAP: Record<string, { Icon: typeof Car; label: string }> = {
  TWO_WHEELER:  { Icon: Bike,  label: '2-Wheeler' },
  FOUR_WHEELER: { Icon: Car,   label: '4-Wheeler' },
  HEAVY:        { Icon: Truck, label: 'Heavy' },
  CAR:          { Icon: Car,   label: '4-Wheeler' },
};

// Editable vehicle types — legacy 'CAR' rows get saved as 'FOUR_WHEELER'.
const VT_OPTIONS = [
  { value: 'TWO_WHEELER',  label: '2-Wheeler', Icon: Bike  },
  { value: 'FOUR_WHEELER', label: '4-Wheeler', Icon: Car   },
  { value: 'HEAVY',        label: 'Heavy',     Icon: Truck },
] as const;

const normalizeVT = (v: string) => (v === 'CAR' ? 'FOUR_WHEELER' : v);

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtINR = (n?: number | null) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

// ── Commission date-range filter ───────────────────────────────────────────────
type CommissionPeriod = 'day' | 'month' | 'year' | 'fy' | 'custom';

const COMMISSION_PERIODS: { key: CommissionPeriod; label: string }[] = [
  { key: 'day',   label: 'Today' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
  { key: 'fy',    label: 'FY' },
  { key: 'custom', label: 'Custom' },
];

const CommissionFilterBar = ({
  period, onPeriod, from, to, onFrom, onTo,
}: {
  period: CommissionPeriod;
  onPeriod: (p: CommissionPeriod) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) => (
  <div className="flex flex-col items-end gap-2">
    <div className="flex flex-wrap gap-1">
      {COMMISSION_PERIODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPeriod(key)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
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
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
               className="input w-36 text-xs sm:w-40" />
        <span className="text-slate-400">→</span>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
               className="input w-36 text-xs sm:w-40" />
      </div>
    )}
  </div>
);

// ── Slot row (inline edit + status toggle) ───────────────────────────────────
const SlotRow = ({
  slot, onToggleStatus, onSaveEdit, onViewBookings, isToggling, isSaving,
}: {
  slot: any;
  onToggleStatus: () => void;
  onSaveEdit: (code: string, hourlyPrice: string, monthlyPrice: string, vehicleType: string) => void;
  onViewBookings: () => void;
  isToggling: boolean;
  isSaving: boolean;
}) => {
  const [editing, setEditing]         = useState(false);
  const [code, setCode]               = useState(slot.code);
  const [price, setPrice]             = useState(String(slot.hourlyPrice ?? ''));
  const [monthly, setMonthly]         = useState(slot.monthlyPrice != null ? String(slot.monthlyPrice) : '');
  const [vehicleType, setVehicleType] = useState(normalizeVT(slot.vehicleType));
  const vt = VT_MAP[slot.vehicleType] ?? { Icon: Car, label: slot.vehicleType };

  const handleSave = () => {
    onSaveEdit(code.trim(), price, monthly, vehicleType);
    setEditing(false);
  };

  const handleCancel = () => {
    setCode(slot.code);
    setPrice(String(slot.hourlyPrice ?? ''));
    setMonthly(slot.monthlyPrice != null ? String(slot.monthlyPrice) : '');
    setVehicleType(normalizeVT(slot.vehicleType));
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <vt.Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-mono">{slot.code}</p>
          <p className="text-xs text-slate-400">
            {vt.label} · ₹{Number(slot.hourlyPrice ?? 0).toLocaleString('en-IN')}/hr
            {slot.monthlyPrice != null && Number(slot.monthlyPrice) > 0 && (
              <> · ₹{Number(slot.monthlyPrice).toLocaleString('en-IN')}/mo</>
            )}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          slot.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {slot.status}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            title="View slot bookings"
            onClick={onViewBookings}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            Bookings
          </button>
          <button
            title="Edit slot"
            onClick={() => setEditing((e) => !e)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            title={slot.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            disabled={isToggling}
            onClick={onToggleStatus}
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {slot.status === 'ACTIVE'
              ? <ToggleRight className="h-4 w-4 text-emerald-500" />
              : <ToggleLeft  className="h-4 w-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          {/* Vehicle type picker (segmented) */}
          <label className="mb-1 block text-xs text-slate-500">Vehicle Type</label>
          <div className="mb-3 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {VT_OPTIONS.map((opt) => {
              const active = vehicleType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVehicleType(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <opt.Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Code + prices + actions */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-slate-500">Slot Code</label>
              <input className="input w-full text-sm" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-slate-500">Price / hr (₹)</label>
              <input type="number" min="0" className="input w-full text-sm" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs text-slate-500">Monthly (₹)</label>
              <input
                type="number" min="0" placeholder="Optional"
                className="input w-full text-sm"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <button className="btn-primary text-xs disabled:opacity-50" disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost text-xs" onClick={handleCancel}>Cancel</button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Monthly = 30-day subscription pass. Leave blank to disable monthly bookings for this slot.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Space card (fully interactive — approve/reject/slots/edit, all inline) ───
const SpaceCard = ({
  space, onEdit,
}: {
  space: any;
  onEdit: (s: any) => void;
}) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [slotsExpanded, setSlotsExpanded]         = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [editingAmenities, setEditingAmenities]   = useState(false);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [isRejecting, setIsRejecting]   = useState(false);
  const [rejectMode, setRejectMode]     = useState<'space' | 'edits'>('space');
  const [rejectNote, setRejectNote]     = useState('');

  // Master amenities list — fetched only when the user opens edit mode
  const { data: amenityListData } = useQuery({
    queryKey: ['admin-amenities'],
    queryFn:  async () => (await api.get('/admin/amenities')).data,
    enabled:  editingAmenities,
  });
  const allAmenities: any[] = amenityListData?.items ?? [];

  // ── Mutations (scoped to a single space) ─────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ['vendor-details'] });

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/spaces/${space.id}/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (note: string) => api.post(`/admin/spaces/${space.id}/reject`, { note }),
    onSuccess: () => { invalidate(); setIsRejecting(false); setRejectNote(''); },
  });
  const rejectEdits = useMutation({
    mutationFn: (note: string) => api.post(`/admin/spaces/${space.id}/reject-edits`, { note }),
    onSuccess: () => { invalidate(); setIsRejecting(false); setRejectNote(''); },
  });
  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/admin/locations/${space.id}/status`, { isActive }),
    onSuccess: invalidate,
  });
  const toggleSlotStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/slots/${id}/status`, { status }),
    onSuccess: invalidate,
  });
  const updateSlot = useMutation({
    mutationFn: ({ id, code, hourlyPrice, monthlyPrice, vehicleType }: {
      id: string; code: string; hourlyPrice: number;
      monthlyPrice: number | null; vehicleType: string;
    }) => api.patch(`/admin/slots/${id}`, { code, hourlyPrice, monthlyPrice, vehicleType }),
    onSuccess: invalidate,
  });
  const saveAmenities = useMutation({
    mutationFn: (amenityIds: string[]) =>
      api.put(`/admin/locations/${space.id}/amenities`, { amenityIds }),
    onSuccess: () => { invalidate(); setEditingAmenities(false); },
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const meta            = SPACE_STATUS_META[space.approvalStatus] ?? SPACE_STATUS_META.PENDING_REVIEW;
  const StatusIcon      = meta.Icon;
  const isApproved      = space.approvalStatus === 'APPROVED';
  const hasPendingEdits = Boolean(space.pendingData);
  const cover           = space.images?.[0]?.url;
  const anyPending      = approve.isPending || reject.isPending || rejectEdits.isPending || toggleActive.isPending;

  const openReject = (mode: 'space' | 'edits') => {
    setRejectMode(mode); setRejectNote(''); setIsRejecting(true);
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
        {/* Thumbnail */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          {cover ? (
            <img src={cover} alt={space.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Building2 className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{space.name}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
              <StatusIcon className="h-3 w-3" /> {meta.label}
            </span>
            {isApproved && !space.isActive && (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Inactive
              </span>
            )}
            {hasPendingEdits && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Has pending edits
              </span>
            )}
          </div>

          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            {space.addressLine}, {space.city}, {space.state}
          </p>
          <p className="text-xs text-slate-400">
            <Layers className="mr-1 inline h-3 w-3" />
            {space.slots?.length ?? 0} slot{space.slots?.length !== 1 ? 's' : ''}
          </p>

          {space.approvalStatus === 'REJECTED' && space.approvalNote && (
            <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              <span className="font-medium">Rejection note: </span>{space.approvalNote}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {space.approvalStatus === 'PENDING_REVIEW' && (
            <>
              <button className="btn-primary text-xs" disabled={approve.isPending} onClick={() => approve.mutate()}>
                {approve.isPending ? 'Approving…' : 'Approve'}
              </button>
              <button
                className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => openReject('space')}
              >
                Reject
              </button>
            </>
          )}

          {isApproved && hasPendingEdits && (
            <>
              <button className="btn-primary text-xs" disabled={approve.isPending} onClick={() => approve.mutate()}>
                {approve.isPending ? 'Approving…' : 'Approve Changes'}
              </button>
              <button
                className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => openReject('edits')}
              >
                Reject Changes
              </button>
            </>
          )}

          {space.slots?.length > 0 && (
            <button
              onClick={() => setSlotsExpanded((s) => !s)}
              className="btn-ghost flex items-center gap-1 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              Slots
              {slotsExpanded
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            onClick={() => setAmenitiesExpanded((s) => !s)}
            className="btn-ghost flex items-center gap-1 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Amenities ({space.amenities?.length ?? 0})
            {amenitiesExpanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <button onClick={() => onEdit(space)} className="btn-ghost text-xs">
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </button>

          <KebabMenu>
            {isApproved && (
              <MenuItem
                disabled={anyPending}
                onClick={() => toggleActive.mutate(!space.isActive)}
              >
                {space.isActive ? 'Deactivate Space' : 'Activate Space'}
              </MenuItem>
            )}
          </KebabMenu>
        </div>
      </div>

      {/* Slot management panel */}
      {slotsExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
            Slots ({space.slots.length})
          </p>
          <div className="space-y-2">
            {space.slots.map((slot: any) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                isToggling={toggleSlotStatus.isPending}
                isSaving={updateSlot.isPending}
                onViewBookings={() =>
                  navigate(`/slots/${slot.id}/bookings?backTo=${encodeURIComponent(`/vendors/${space.vendorId}`)}`)
                }
                onToggleStatus={() =>
                  toggleSlotStatus.mutate({
                    id: slot.id,
                    status: slot.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                  })
                }
                onSaveEdit={(code, hourlyPrice, monthlyPrice, vehicleType) => {
                  const mp = monthlyPrice.trim();
                  updateSlot.mutate({
                    id: slot.id,
                    code,
                    hourlyPrice: Number(hourlyPrice),
                    monthlyPrice: mp === '' ? null : Number(mp),
                    vehicleType,
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Amenities panel — display + inline edit */}
      {amenitiesExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Amenities ({space.amenities?.length ?? 0})
            </p>
            {!editingAmenities ? (
              <button
                onClick={() => {
                  setSelectedAmenityIds((space.amenities ?? []).map((a: any) => a.amenityId));
                  setEditingAmenities(true);
                }}
                className="btn-ghost text-xs"
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit Amenities
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  className="btn-primary flex items-center gap-1 text-xs disabled:opacity-50"
                  disabled={saveAmenities.isPending}
                  onClick={() => saveAmenities.mutate(selectedAmenityIds)}
                >
                  <Save className="h-3 w-3" />
                  {saveAmenities.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setEditingAmenities(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Display mode */}
          {!editingAmenities && (
            (space.amenities?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                No amenities added yet. Click "Edit Amenities" to add some.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {space.amenities.map((a: any) => (
                  <span
                    key={a.amenityId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <AmenityIcon icon={a.amenity?.icon ?? ''} className="h-3.5 w-3.5" />
                    {a.amenity?.name ?? '—'}
                  </span>
                ))}
              </div>
            )
          )}

          {/* Edit mode — toggleable grid of all amenities */}
          {editingAmenities && (
            <>
              {allAmenities.length === 0 ? (
                <p className="text-center text-xs text-slate-400">Loading amenities…</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-slate-500">
                    Click to toggle. <span className="font-medium">{selectedAmenityIds.length}</span> selected.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {allAmenities.map((a: any) => {
                      const selected = selectedAmenityIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAmenityIds((ids) =>
                            ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id],
                          )}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                            selected
                              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {selected
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                            : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600" />}
                          <AmenityIcon icon={a.icon ?? ''} className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {saveAmenities.isError && (
                    <p className="mt-2 text-xs text-red-600">Failed to save amenities. Try again.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Reject panel */}
      {isRejecting && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            {rejectMode === 'edits'
              ? 'Reason for rejecting vendor changes:'
              : 'Rejection reason (shown to vendor):'}
          </p>
          <textarea
            className="input w-full text-sm"
            rows={2}
            placeholder={rejectMode === 'edits'
              ? 'Explain why the changes are not approved…'
              : 'Explain why this space is being rejected…'}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary text-xs bg-red-600 hover:bg-red-700"
              disabled={reject.isPending || rejectEdits.isPending}
              onClick={() =>
                rejectMode === 'edits'
                  ? rejectEdits.mutate(rejectNote)
                  : reject.mutate(rejectNote)
              }
            >
              {reject.isPending || rejectEdits.isPending
                ? 'Rejecting…'
                : rejectMode === 'edits' ? 'Confirm Reject Changes' : 'Confirm Reject'}
            </button>
            <button className="btn-ghost text-xs" onClick={() => { setIsRejecting(false); setRejectNote(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
export const VendorDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editSpace, setEditSpace] = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor-details', id],
    queryFn: async () => (await api.get(`/admin/vendors/${id}`)).data,
    enabled: Boolean(id),
  });

  const [commPeriod, setCommPeriod] = useState<CommissionPeriod>('month');
  const [commFrom, setCommFrom] = useState('');
  const [commTo, setCommTo] = useState('');
  const commissionParams =
    commPeriod === 'custom'
      ? (commFrom && commTo ? { period: 'custom', from: commFrom, to: commTo } : { period: 'month' })
      : { period: commPeriod };
  const { data: commData } = useQuery({
    queryKey: ['vendor-commission', id, commissionParams],
    queryFn: async () => (await api.get(`/admin/vendors/${id}/commission`, { params: commissionParams })).data,
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

  if (error || !data?.vendor) {
    return (
      <section className="p-6">
        <button
          onClick={() => navigate('/vendors')}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Vendors
        </button>
        <div className="card p-10 text-center text-sm text-red-500">
          Vendor not found.
        </div>
      </section>
    );
  }

  const v: any           = data.vendor;
  const origin: any      = data.origin ?? {};
  const stats            = data.stats ?? {};
  const locations: any[] = v.locations ?? [];
  const bookings: any[]  = data.bookings ?? [];
  const statusCls        = VENDOR_STATUS_CLS[v.status] ?? VENDOR_STATUS_CLS.INACTIVE;

  return (
    <section className="space-y-5 p-6">
      {/* ── Top bar ── */}
      <div>
        <button
          onClick={() => navigate('/vendors')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Vendors
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{v.businessName}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                {v.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Joined {fmtDate(v.createdAt)} · Vendor ID <span className="font-mono">{v.id}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => navigate(`/spaces/add?vendorId=${v.id}&vendorName=${encodeURIComponent(v.businessName ?? '')}`)}
              className="btn-primary flex items-center gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Parking Space
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Building2 className="h-4 w-4 text-brand-500" />}
                  label="Parking Spaces" value={stats.spaces ?? 0} />
        <StatTile icon={<Layers className="h-4 w-4 text-indigo-500" />}
                  label="Total Slots" value={stats.slots ?? 0} />
        <StatTile icon={<CalendarCheck className="h-4 w-4 text-emerald-500" />}
                  label="Confirmed Bookings" value={stats.bookingsConfirmed ?? 0}
                  sub={`${stats.bookingsTotal ?? 0} total`} />
        <StatTile icon={<IndianRupee className="h-4 w-4 text-amber-500" />}
                  label="Revenue" value={fmtINR(stats.revenue)} />
      </div>

      {/* ── Commission ── */}
      <div className="card border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold">Commission Owed by this Vendor</h2>
          </div>
          <CommissionFilterBar
            period={commPeriod} onPeriod={setCommPeriod}
            from={commFrom} to={commTo} onFrom={setCommFrom} onTo={setCommTo}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={<Percent className="h-4 w-4 text-amber-500" />}
                    label="Total Commission" value={fmtINR(commData?.total ?? 0)} />
          <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    label="Received" value={fmtINR(commData?.paid ?? 0)} />
          <StatTile icon={<Clock className="h-4 w-4 text-red-500" />}
                    label="Pending Collection" value={fmtINR(commData?.pending ?? 0)} />
        </div>

        {/* Per-space breakdown */}
        {(commData?.bySpace?.length ?? 0) > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-amber-100 bg-white dark:border-amber-900/30 dark:bg-slate-900">
            <table className="table">
              <thead>
                <tr>
                  <th>Space</th>
                  <th>Total</th>
                  <th>Received</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {(commData?.bySpace ?? []).map((s: any) => (
                  <tr key={s.locationId}>
                    <td className="text-sm">
                      <p className="font-medium">{s.name}</p>
                      {s.city && <p className="text-xs text-slate-400">{s.city}</p>}
                    </td>
                    <td className="font-semibold">{fmtINR(s.total)}</td>
                    <td className="text-emerald-600 dark:text-emerald-400">{fmtINR(s.paid)}</td>
                    <td className={s.pending > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400'}>
                      {fmtINR(s.pending)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Vendor & owner details ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Business Details</h2>
          <dl className="space-y-2 text-sm">
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Business Name" value={v.businessName} />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />}     label="Contact Phone" value={v.contactPhone} />
            <DetailRow icon={<MapPin className="h-3.5 w-3.5" />}    label="Address"       value={v.address} multi />
            {v.aadharNumber && (
              <DetailRow icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                         label="Aadhar Number" value={v.aadharNumber} mono />
            )}
            {v.gstNumber   && <DetailRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="GST Number" value={v.gstNumber} mono />}
            {v.panNumber   && <DetailRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="PAN Number" value={v.panNumber} mono />}
            {v.payoutUpiId && <DetailRow icon={<IndianRupee className="h-3.5 w-3.5" />} label="Payout UPI" value={v.payoutUpiId} mono />}
            <DetailRow
              icon={<ShieldCheck className={`h-3.5 w-3.5 ${v.aadharVerifiedAt ? 'text-emerald-500' : 'text-amber-500'}`} />}
              label="Aadhar Doc"
              value={<AadharStatus vendor={v} />}
            />
            {/* ── Status timeline — created / approved / rejected / deactivated ── */}
            {/* "Joined" is already shown in the page header subtitle, no duplicate here. */}
            <DetailRow
              icon={<UserPlus className="h-3.5 w-3.5 text-slate-500" />}
              label="Account created"
              value={
                origin.createdVia === 'ADMIN'
                  ? `By admin${origin.createdBy?.fullName ? ` — ${origin.createdBy.fullName}` : ''} · ${fmtDate(origin.createdAt ?? v.createdAt)}`
                  : `Self-registration · ${fmtDate(origin.createdAt ?? v.createdAt)}`
              }
            />
            {v.approvedAt && (
              <DetailRow
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                label="Approved on"
                value={`${fmtDate(v.approvedAt)}${origin.approvedBy?.fullName ? ` · by ${origin.approvedBy.fullName}` : ''}`}
              />
            )}
            {v.rejectedAt && (
              <DetailRow
                icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
                label="Rejected on"
                value={fmtDate(v.rejectedAt)}
              />
            )}
            {v.deactivatedAt && (
              <DetailRow
                icon={<Clock className="h-3.5 w-3.5 text-slate-500" />}
                label="Stopped on"
                value={`${fmtDate(v.deactivatedAt)}${origin.deactivatedBy?.fullName ? ` · by ${origin.deactivatedBy.fullName}` : ''}`}
              />
            )}
            {v.status === 'REJECTED' && v.rejectionNote && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                <span className="font-medium">Rejection reason:</span> {v.rejectionNote}
              </div>
            )}
            {v.status === 'INACTIVE' && v.deactivatedAt && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                <span className="font-medium">Inactive:</span> this vendor stopped working with us on {fmtDate(v.deactivatedAt)}.
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Owner / Account</h2>
          <dl className="space-y-2 text-sm">
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Full Name"  value={v.user?.fullName} />
            <DetailRow icon={<Mail className="h-3.5 w-3.5" />}      label="Email"      value={
              <span className="inline-flex items-center gap-1.5">
                {v.user?.email}
                {v.user?.emailVerified
                  ? <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                    </span>
                  : <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Unverified
                    </span>}
              </span>
            } />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />}     label="Phone"      value={v.user?.phone} />
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />}  label="Registered" value={fmtDate(v.user?.createdAt)} />
            {v.user?.status && (
              <DetailRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Account Status" value={v.user.status} />
            )}
          </dl>
        </div>
      </div>

      {/* ── Parking spaces (fully interactive) ── */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            Parking Spaces <span className="text-slate-400">({locations.length})</span>
          </h2>
        </div>

        {locations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            This vendor hasn't added any parking spaces yet.
          </div>
        ) : (
          <div>
            {locations.map((loc: any) => (
              <SpaceCard key={loc.id} space={loc} onEdit={setEditSpace} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bookings under this vendor (most recent 50) ── */}
      <VendorBookingsCard bookings={bookings} total={stats.bookingsTotal ?? 0} />

      {/* ── Edit space slide-over ── */}
      {editSpace && (
        <EditSpaceSlideOver
          space={editSpace}
          onClose={() => setEditSpace(null)}
        />
      )}
    </section>
  );
};

// ── Presentational pieces ────────────────────────────────────────────────────
// Aadhaar doc status + actions. Three states:
//   • verified              → "View document" + Verified badge
//   • uploaded, unverified  → "View document" + Pending badge + Approve / Reject
//   • not uploaded          → Pending badge + admin direct-upload (auto-verified)
const AadharStatus = ({ vendor }: { vendor: any }) => {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['vendor-details', vendor.id] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<{ url: string }>('/uploads/documents', fd);
      await api.patch(`/admin/vendors/${vendor.id}`, { aadharDocUrl: data.url });
    },
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: () => api.post(`/admin/vendors/${vendor.id}/aadhaar/approve`),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admin/vendors/${vendor.id}/aadhaar/reject`),
    onSuccess: invalidate,
  });

  const viewLink = (
    <a href={vendor.aadharDocUrl} target="_blank" rel="noreferrer"
       className="text-brand-600 underline dark:text-brand-400">View document</a>
  );

  // State 1 & 2 — a doc exists.
  if (vendor.aadharDocUrl) {
    if (vendor.aadharVerifiedAt) {
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          {viewLink}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        </span>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {viewLink}
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Pending verification
        </span>
        <button type="button" onClick={() => approve.mutate()} disabled={approve.isPending}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          <CheckCircle2 className="h-3 w-3" /> {approve.isPending ? 'Approving…' : 'Approve'}
        </button>
        <button type="button" onClick={() => reject.mutate()} disabled={reject.isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/50 dark:hover:bg-red-900/20">
          <XCircle className="h-3 w-3" /> Reject
        </button>
      </div>
    );
  }

  // State 3 — nothing uploaded; admin can upload directly (auto-verified).
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Pending — not uploaded
      </span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={upload.isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        <Upload className="h-3 w-3" />
        {upload.isPending ? 'Uploading…' : 'Upload Aadhaar'}
      </button>
      {upload.isError && <span className="text-xs text-red-500">Upload failed</span>}
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

// ── Bookings under this vendor ────────────────────────────────────────────────
const BOOKING_STATUS_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  COMPLETED:       'bg-slate-100   text-slate-600   dark:bg-slate-800     dark:text-slate-400',
  PENDING_PAYMENT: 'bg-amber-100   text-amber-800   dark:bg-amber-900/30  dark:text-amber-300',
  CANCELLED:       'bg-red-100     text-red-800     dark:bg-red-900/30    dark:text-red-300',
  FAILED:          'bg-red-100     text-red-800     dark:bg-red-900/30    dark:text-red-300',
};

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const VendorBookingsCard = ({ bookings, total }: { bookings: any[]; total: number }) => (
  <div className="card">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
      <h2 className="text-sm font-semibold">
        Bookings <span className="text-slate-400">({bookings.length}{total > bookings.length ? ` of ${total}` : ''})</span>
      </h2>
      {total > bookings.length && (
        <span className="text-xs text-slate-400">Showing most recent {bookings.length}</span>
      )}
    </div>

    {bookings.length === 0 ? (
      <div className="p-8 text-center text-sm text-slate-400">
        No bookings yet for this vendor.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Space · Slot</th>
              <th>Start</th>
              <th>End</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const customerName = b.isDirectBooking
                ? (b.guestName ?? 'Walk-in Guest')
                : (b.user?.fullName ?? '—');
              const customerSub = b.isDirectBooking
                ? (b.guestPhone ?? 'Direct booking')
                : (b.user?.email ?? '');
              const payment = b.payments?.[0];
              return (
                <tr key={b.id}>
                  <td>
                    <p className="text-sm font-medium">{customerName}</p>
                    <p className="text-xs text-slate-400">{customerSub}</p>
                  </td>
                  <td className="text-sm">
                    {b.slot?.location?.name}
                    <span className="ml-1 font-mono text-xs text-slate-400">· {b.slot?.code}</span>
                    {b.slot?.location?.city && (
                      <p className="text-xs text-slate-400">{b.slot.location.city}</p>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">{fmtDateTime(b.startAt)}</td>
                  <td className="text-xs text-slate-500">{fmtDateTime(b.endAt)}</td>
                  <td className="text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {b.bookingType ?? 'HOURLY'}
                    </span>
                  </td>
                  <td className="font-semibold">{fmtINR(Number(b.totalAmount))}</td>
                  <td className="text-xs text-slate-500">
                    {b.isDirectBooking
                      ? (b.paymentMethod ?? 'Direct')
                      : (payment?.status ?? '—')}
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        BOOKING_STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
