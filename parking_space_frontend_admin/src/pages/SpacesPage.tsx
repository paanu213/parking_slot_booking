import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, CheckCircle2, XCircle, MapPin, Layers, Plus,
  Bike, Car, Truck, ChevronDown, ChevronUp, Pencil, ToggleLeft, ToggleRight,
  ArrowLeft, Building2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';

// ── Types ─────────────────────────────────────────────────────────────────────
type ApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
type SlotStatus = 'ACTIVE' | 'INACTIVE';

interface Slot {
  id: string;
  code: string;
  vehicleType: string;
  hourlyPrice: number;
  monthlyPrice?: number | null;
  status: SlotStatus;
}

interface Space {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  approvalStatus: ApprovalStatus;
  approvalNote?: string;
  pendingData?: string;
  isActive: boolean;
  createdAt: string;
  slots: Slot[];
  vendor: { businessName: string; user: { fullName: string; email: string } };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_META: Record<ApprovalStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Clock className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Approved',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const TABS: { value: ApprovalStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',            label: 'All' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED',       label: 'Approved' },
  { value: 'REJECTED',       label: 'Rejected' },
];

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

// KebabMenu is imported from @/components/KebabMenu — portal-based, always on top.

// ── Slot management row ───────────────────────────────────────────────────────
const SlotRow = ({
  slot,
  onToggleStatus,
  onSaveEdit,
  isToggling,
  isSaving,
}: {
  slot: Slot;
  onToggleStatus: () => void;
  onSaveEdit: (code: string, hourlyPrice: string, monthlyPrice: string, vehicleType: string) => void;
  isToggling: boolean;
  isSaving: boolean;
}) => {
  const [editing, setEditing]         = useState(false);
  const [code, setCode]               = useState(slot.code);
  const [price, setPrice]             = useState(String(slot.hourlyPrice));
  const [monthly, setMonthly]         = useState(slot.monthlyPrice != null ? String(slot.monthlyPrice) : '');
  const [vehicleType, setVehicleType] = useState(normalizeVT(slot.vehicleType));
  const vt = VT_MAP[slot.vehicleType] ?? { Icon: Car, label: slot.vehicleType };

  const handleSave = () => {
    onSaveEdit(code.trim(), price, monthly, vehicleType);
    setEditing(false);
  };

  const handleCancel = () => {
    setCode(slot.code);
    setPrice(String(slot.hourlyPrice));
    setMonthly(slot.monthlyPrice != null ? String(slot.monthlyPrice) : '');
    setVehicleType(normalizeVT(slot.vehicleType));
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Vehicle icon badge */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <vt.Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>

        {/* Code + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-mono">{slot.code}</p>
          <p className="text-xs text-slate-400">
            {vt.label} · ₹{Number(slot.hourlyPrice).toLocaleString('en-IN')}/hr
            {slot.monthlyPrice != null && Number(slot.monthlyPrice) > 0 && (
              <> · ₹{Number(slot.monthlyPrice).toLocaleString('en-IN')}/mo</>
            )}
          </p>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          slot.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {slot.status}
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
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

      {/* Inline edit form */}
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
              <input
                className="input w-full text-sm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-slate-500">Price / hr (₹)</label>
              <input
                type="number"
                min="0"
                className="input w-full text-sm"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs text-slate-500">Monthly (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="Optional"
                className="input w-full text-sm"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <button
              className="btn-primary text-xs disabled:opacity-50"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost text-xs" onClick={handleCancel}>
              Cancel
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Monthly = 30-day subscription pass. Leave blank to disable monthly bookings for this slot.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const SpacesPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vendorId   = searchParams.get('vendorId')   ?? undefined;
  const vendorName = searchParams.get('vendorName') ?? undefined;
  const isVendorScoped = Boolean(vendorId);

  const [tab, setTab]               = useState<ApprovalStatus | 'ALL'>('ALL');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote]   = useState('');
  const [rejectMode, setRejectMode]   = useState<'space' | 'edits'>('space');
  const [expandedSlotsId, setExpandedSlotsId] = useState<string | null>(null);

  // ── Queries & mutations ─────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admin-spaces', tab, vendorId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tab !== 'ALL') params.status   = tab;
      if (vendorId)      params.vendorId = vendorId;
      return (await api.get('/admin/spaces', { params })).data;
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/spaces/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-spaces'] }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/admin/spaces/${id}/reject`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-spaces'] });
      setRejectingId(null); setRejectNote('');
    },
  });

  const rejectEdits = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/admin/spaces/${id}/reject-edits`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-spaces'] });
      setRejectingId(null); setRejectNote('');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/locations/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-spaces'] }),
  });

  const toggleSlotStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/slots/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-spaces'] }),
  });

  const updateSlot = useMutation({
    mutationFn: ({ id, code, hourlyPrice, monthlyPrice, vehicleType }: {
      id: string; code: string; hourlyPrice: number;
      monthlyPrice: number | null; vehicleType: string;
    }) => api.patch(`/admin/slots/${id}`, { code, hourlyPrice, monthlyPrice, vehicleType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-spaces'] }),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const openReject = (id: string, mode: 'space' | 'edits') => {
    setRejectingId(id); setRejectMode(mode); setRejectNote('');
  };

  const anyPending =
    approve.isPending || reject.isPending || rejectEdits.isPending ||
    toggleActive.isPending;

  const spaces: Space[] = data?.items ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isVendorScoped && (
            <button
              onClick={() => navigate('/vendors')}
              className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Vendors
            </button>
          )}
          <h1 className="text-2xl font-bold">
            {isVendorScoped ? 'Vendor Spaces' : 'Parking Spaces'}
          </h1>
          {isVendorScoped ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="h-4 w-4 text-brand-500" />
              Showing spaces for{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {vendorName ?? 'this vendor'}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Review, approve, and manage all parking locations and their slots.
            </p>
          )}
        </div>
        <button
          onClick={() =>
            navigate(
              isVendorScoped
                ? `/spaces/add?vendorId=${vendorId}&vendorName=${encodeURIComponent(vendorName ?? '')}`
                : '/spaces/add',
            )
          }
          className="btn-primary flex shrink-0 items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Parking Space
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mt-4 flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map((t) => (
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

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <>
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </>
        ) : spaces.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            No spaces found for this filter.
          </div>
        ) : (
          spaces.map((space) => {
            const meta            = STATUS_META[space.approvalStatus];
            const isRejecting     = rejectingId === space.id;
            const isApproved      = space.approvalStatus === 'APPROVED';
            const hasPendingEdits = Boolean(space.pendingData);
            const slotsExpanded   = expandedSlotsId === space.id;

            return (
              <div key={space.id} className="card">
                {/* ── Main row ── */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{space.name}</h3>

                      {/* Approval status badge */}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>

                      {/* Active / Inactive badge (only relevant when approved) */}
                      {isApproved && !space.isActive && (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Inactive
                        </span>
                      )}

                      {/* Pending edits badge */}
                      {hasPendingEdits && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Has pending edits
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {space.addressLine}, {space.city}, {space.state}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {space.slots.length} slot{space.slots.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      Vendor:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {space.vendor?.businessName}
                      </span>{' '}
                      &mdash; {space.vendor?.user?.email}
                    </div>

                    {/* Rejection note */}
                    {space.approvalStatus === 'REJECTED' && space.approvalNote && (
                      <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                        <span className="font-medium">Rejection note: </span>
                        {space.approvalNote}
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Approve + Reject — only when PENDING_REVIEW */}
                    {space.approvalStatus === 'PENDING_REVIEW' && (
                      <>
                        <button
                          className="btn-primary text-xs"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate(space.id)}
                        >
                          {approve.isPending && approve.variables === space.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => openReject(space.id, 'space')}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Approve Changes — APPROVED with pending edits */}
                    {isApproved && hasPendingEdits && (
                      <button
                        className="btn-primary text-xs"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(space.id)}
                      >
                        {approve.isPending && approve.variables === space.id ? 'Approving…' : 'Approve Changes'}
                      </button>
                    )}

                    {/* Manage Slots toggle button */}
                    {space.slots.length > 0 && (
                      <button
                        onClick={() => setExpandedSlotsId(slotsExpanded ? null : space.id)}
                        className="btn-ghost flex items-center gap-1 text-xs"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Slots
                        {slotsExpanded
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {/* 3-dot kebab — portal-based, always above table */}
                    <KebabMenu>
                      <MenuItem onClick={() => navigate(`/spaces/${space.id}/edit`)}>
                        Edit Space
                      </MenuItem>
                      {isApproved && (
                        <MenuItem
                          disabled={anyPending}
                          onClick={() =>
                            toggleActive.mutate({ id: space.id, isActive: !space.isActive })
                          }
                        >
                          {space.isActive ? 'Deactivate Space' : 'Activate Space'}
                        </MenuItem>
                      )}
                    </KebabMenu>
                  </div>
                </div>

                {/* ── Slot management panel ── */}
                {slotsExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Slots ({space.slots.length})
                    </p>
                    <div className="space-y-2">
                      {space.slots.map((slot) => (
                        <SlotRow
                          key={slot.id}
                          slot={slot}
                          isToggling={toggleSlotStatus.isPending}
                          isSaving={updateSlot.isPending}
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

                {/* ── Reject / Reject-edits panel ── */}
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
                      placeholder={
                        rejectMode === 'edits'
                          ? 'Explain why the changes are not approved…'
                          : 'Explain why this space is being rejected…'
                      }
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                        disabled={reject.isPending || rejectEdits.isPending}
                        onClick={() =>
                          rejectMode === 'edits'
                            ? rejectEdits.mutate({ id: space.id, note: rejectNote })
                            : reject.mutate({ id: space.id, note: rejectNote })
                        }
                      >
                        {reject.isPending || rejectEdits.isPending
                          ? 'Rejecting…'
                          : rejectMode === 'edits' ? 'Confirm Reject Changes' : 'Confirm Reject'}
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => { setRejectingId(null); setRejectNote(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
