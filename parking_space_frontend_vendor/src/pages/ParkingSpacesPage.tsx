import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Sparkles, Bike, Car, Truck, Trash2, CalendarCheck } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { api } from '@/lib/api';
import { AmenityIcon } from '@/components/AmenityIcon';
import { LocationImages } from '@/features/LocationImages';
import { SpaceForm, type SpaceFormValues } from '@/features/SpaceForm';

interface Amenity {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

type ApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

const VEHICLE_TYPE_MAP: Record<string, { Icon: React.ComponentType<LucideProps>; label: string }> = {
  TWO_WHEELER:  { Icon: Bike,  label: '2-Wheeler' },
  FOUR_WHEELER: { Icon: Car,   label: '4-Wheeler' },
  HEAVY:        { Icon: Truck, label: 'Heavy' },
};

interface Slot {
  id: string;
  code: string;
  vehicleType: string;
  hourlyPrice: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Image {
  id: string;
  url: string;
  sortOrder: number;
}

interface ParkingSpace {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  description?: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  approvalNote?: string;
  pendingData?: string;
  slots: Slot[];
  images: Image[];
  amenities: { amenity: Amenity }[];
}

interface SlotFormValues {
  code: string;
  vehicleType: string;
  hourlyPrice: number;
}

const STATUS_META: Record<ApprovalStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING_REVIEW: {
    label: 'Under Review',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Clock className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Live',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: <XCircle className="h-3 w-3" />,
  },
};

export const ParkingSpacesPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingAmenitiesId, setEditingAmenitiesId] = useState<string | null>(null);
  const [amenityDraft, setAmenityDraft] = useState<Set<string>>(new Set());

  const list = useQuery({
    queryKey: ['vendor-spaces'],
    queryFn: async () => (await api.get<{ items: ParkingSpace[] }>('/vendor/locations')).data,
  });

  const amenitiesQuery = useQuery<{ items: Amenity[] }>({
    queryKey: ['amenities'],
    queryFn: async () => (await api.get('/vendor/amenities')).data,
    staleTime: 60_000,
  });
  const allAmenities = amenitiesQuery.data?.items ?? [];

  const updateAmenities = useMutation({
    mutationFn: ({ id, amenityIds }: { id: string; amenityIds: string[] }) =>
      api.put(`/vendor/locations/${id}/amenities`, { amenityIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-spaces'] });
      setEditingAmenitiesId(null);
    },
  });

  const updateSpace = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SpaceFormValues }) =>
      api.put(`/vendor/locations/${id}`, input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-spaces'] });
      setEditingSpaceId(null);
    },
  });

  const toggleSpace = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/vendor/locations/${id}/status`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-spaces'] }),
  });

  const deleteSpace = useMutation({
    mutationFn: (id: string) => api.delete(`/vendor/locations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-spaces'] }),
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error?.message ??
        e?.response?.data?.message ??
        'Failed to delete. Please try again.';
      alert(msg);
    },
  });

  const addSlot = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SlotFormValues }) =>
      api.post(`/vendor/locations/${id}/slots`, input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-spaces'] }),
  });

  const updateSlot = useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: Partial<SlotFormValues> }) =>
      api.patch(`/vendor/slots/${slotId}`, input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-spaces'] });
      setEditingSlotId(null);
    },
  });

  const toggleSlot = useMutation({
    mutationFn: ({ slotId, status }: { slotId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      api.patch(`/vendor/slots/${slotId}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-spaces'] }),
  });

  const spaces = list.data?.items ?? [];

  return (
    <section className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parking Spaces</h1>
        <button className="btn-primary" onClick={() => navigate('/spaces/add')}>
          + Add Space
        </button>
      </div>

      {/* Space list */}
      <div className="mt-6 space-y-4">
        {list.isLoading ? (
          <>
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </>
        ) : spaces.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            No parking spaces yet. Add your first one above.
          </div>
        ) : (
          spaces.map((space) => {
            const meta = STATUS_META[space.approvalStatus];
            const isApproved = space.approvalStatus === 'APPROVED';
            const isRejected = space.approvalStatus === 'REJECTED';
            const hasPendingEdits = Boolean(space.pendingData);
            const isExpanded = expandedId === space.id;
            const isEditingSpace = editingSpaceId === space.id;

            return (
              <div key={space.id} className="card overflow-hidden">
                {/* Card header */}
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{space.name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                      {isApproved && !space.isActive && (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Inactive
                        </span>
                      )}
                      {hasPendingEdits && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          <AlertCircle className="h-3 w-3" /> Changes under review
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {space.addressLine}, {space.city}, {space.state}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Edit — available for all statuses */}
                    {!isEditingSpace && (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => setEditingSpaceId(space.id)}
                      >
                        Edit
                      </button>
                    )}
                    {isEditingSpace && (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => setEditingSpaceId(null)}
                      >
                        Cancel Edit
                      </button>
                    )}

                    {/* Activate / Deactivate — only for approved spaces */}
                    {isApproved && (
                      <button
                        className="btn-ghost text-xs"
                        disabled={toggleSpace.isPending}
                        onClick={() => toggleSpace.mutate({ id: space.id, isActive: !space.isActive })}
                      >
                        {space.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}

                    {/* Delete — only for pending / rejected spaces */}
                    {!isApproved && (
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
                        disabled={deleteSpace.isPending && deleteSpace.variables === space.id}
                        onClick={() => {
                          if (confirm(`Delete "${space.name}"? This cannot be undone.`)) {
                            deleteSpace.mutate(space.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleteSpace.isPending && deleteSpace.variables === space.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}

                    {/* Expand slots/images */}
                    <button
                      className="btn-ghost text-xs inline-flex items-center gap-1"
                      onClick={() => setExpandedId(isExpanded ? null : space.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isApproved ? `Slots (${space.slots.length})` : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Status banners */}
                {space.approvalStatus === 'PENDING_REVIEW' && (
                  <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                    Awaiting admin review. Slot management will be available once approved.
                  </div>
                )}
                {isRejected && space.approvalNote && (
                  <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                    <span className="font-medium">Rejected: </span>{space.approvalNote}
                    <span className="ml-1 font-medium">Edit the details below and resubmit.</span>
                  </div>
                )}
                {hasPendingEdits && isApproved && (
                  <div className="mx-4 mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                    Your edits are awaiting admin approval. The current live version is unchanged until then.
                  </div>
                )}

                {/* Inline edit form */}
                {isEditingSpace && (
                  <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                    <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isApproved
                        ? 'Edit Space — changes will go to admin for approval before going live'
                        : isRejected
                        ? 'Edit & Resubmit for Review'
                        : 'Update Submission'}
                    </p>
                    <SpaceForm
                      defaultValues={space}
                      onSubmit={(v) => updateSpace.mutate({ id: space.id, input: v })}
                      submitting={updateSpace.isPending}
                      submitLabel={
                        isApproved ? 'Submit Changes for Review' : 'Resubmit for Review'
                      }
                      onCancel={() => setEditingSpaceId(null)}
                    />
                  </div>
                )}

                {/* Expanded: images + amenities + slots */}
                {isExpanded && (
                  <div className="space-y-6 border-t border-slate-200 p-4 dark:border-slate-800">
                    <LocationImages locationId={space.id} images={space.images ?? []} />

                    {/* Amenities */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                          <Sparkles className="h-4 w-4 text-brand-500" /> Amenities
                        </h4>
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => {
                            if (editingAmenitiesId === space.id) {
                              setEditingAmenitiesId(null);
                            } else {
                              setEditingAmenitiesId(space.id);
                              setAmenityDraft(
                                new Set(space.amenities?.map((a) => a.amenity.id) ?? []),
                              );
                            }
                          }}
                        >
                          {editingAmenitiesId === space.id ? 'Cancel' : 'Edit Amenities'}
                        </button>
                      </div>

                      {editingAmenitiesId === space.id ? (
                        <div className="space-y-3">
                          {allAmenities.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              No amenities added by admin yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {allAmenities.map((a) => {
                                const selected = amenityDraft.has(a.id);
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => {
                                      setAmenityDraft((prev) => {
                                        const next = new Set(prev);
                                        next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                                        return next;
                                      });
                                    }}
                                    className={`relative rounded-xl border-2 p-2.5 text-left text-xs transition ${
                                      selected
                                        ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                                    }`}
                                  >
                                    <AmenityIcon icon={a.icon} />
                                    <p className={`mt-1 font-semibold ${selected ? 'text-brand-700 dark:text-brand-400' : ''}`}>
                                      {a.name}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary text-xs"
                              disabled={updateAmenities.isPending}
                              onClick={() =>
                                updateAmenities.mutate({
                                  id: space.id,
                                  amenityIds: [...amenityDraft],
                                })
                              }
                            >
                              {updateAmenities.isPending ? 'Saving…' : 'Save Amenities'}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost text-xs"
                              onClick={() => setEditingAmenitiesId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(space.amenities ?? []).length === 0 ? (
                            <p className="text-xs text-slate-400">No amenities selected yet.</p>
                          ) : (
                            space.amenities.map(({ amenity: a }) => (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300"
                              >
                                <AmenityIcon icon={a.icon} /> {a.name}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Slot management — only for approved spaces */}
                    {isApproved ? (
                      <div>
                        <h4 className="mb-3 text-sm font-semibold">Parking Slots</h4>

                        {space.slots.length === 0 && (
                          <p className="mb-3 text-xs text-slate-500">No slots added yet. Add your first slot below.</p>
                        )}

                        <div className="space-y-2">
                          {space.slots.map((slot) => {
                            const isEditingSlot = editingSlotId === slot.id;
                            return (
                              <div key={slot.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
                                {isEditingSlot ? (
                                  <SlotEditForm
                                    slot={slot}
                                    onSubmit={(v) => updateSlot.mutate({ slotId: slot.id, input: v })}
                                    submitting={updateSlot.isPending}
                                    onCancel={() => setEditingSlotId(null)}
                                  />
                                ) : (
                                  <div className="flex items-center justify-between px-3 py-2.5">
                                    <div className="flex items-center gap-3">
                                      {/* Vehicle type icon */}
                                      {(() => {
                                        const vt = VEHICLE_TYPE_MAP[slot.vehicleType];
                                        const Icon = vt?.Icon ?? Car;
                                        return (
                                          <div
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
                                            title={vt?.label ?? slot.vehicleType}
                                          >
                                            <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                          </div>
                                        );
                                      })()}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium">Slot {slot.code}</span>
                                          <span className="text-xs text-slate-400">
                                            {VEHICLE_TYPE_MAP[slot.vehicleType]?.label ?? slot.vehicleType}
                                          </span>
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                            slot.status === 'ACTIVE'
                                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                              : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                          }`}>
                                            {slot.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                          ₹{slot.hourlyPrice}/hr
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        className="btn-ghost text-xs inline-flex items-center gap-1"
                                        onClick={() => navigate(`/slots/${slot.id}/bookings`)}
                                      >
                                        <CalendarCheck className="h-3.5 w-3.5" />
                                        Bookings
                                      </button>
                                      <button
                                        className="btn-ghost text-xs"
                                        onClick={() => setEditingSlotId(slot.id)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="btn-ghost text-xs"
                                        disabled={toggleSlot.isPending}
                                        onClick={() =>
                                          toggleSlot.mutate({
                                            slotId: slot.id,
                                            status: slot.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                          })
                                        }
                                      >
                                        {slot.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add slot form */}
                        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <p className="mb-2 text-xs font-medium text-slate-500">Add New Slot</p>
                          <NewSlotForm
                            onSubmit={(v) => addSlot.mutate({ id: space.id, input: v })}
                            submitting={addSlot.isPending}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
                        Slot management is available once your space is approved by admin.
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
  );
};

const VEHICLE_TYPES = Object.entries(VEHICLE_TYPE_MAP) as [string, { Icon: React.ComponentType<LucideProps>; label: string }][];

const SlotEditForm = ({
  slot,
  onSubmit,
  submitting,
  onCancel,
}: {
  slot: Slot;
  onSubmit: (v: Partial<SlotFormValues>) => void;
  submitting: boolean;
  onCancel: () => void;
}) => {
  const [vehicleType, setVehicleType] = useState(slot.vehicleType || 'FOUR_WHEELER');
  const { register, handleSubmit } = useForm<SlotFormValues>({
    defaultValues: { code: slot.code, hourlyPrice: slot.hourlyPrice },
  });
  return (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({ code: v.code, vehicleType, hourlyPrice: Number(v.hourlyPrice) })
      )}
      className="space-y-3 p-3"
    >
      <div className="flex gap-1.5">
        {VEHICLE_TYPES.map(([key, { Icon, label }]) => (
          <button
            key={key}
            type="button"
            onClick={() => setVehicleType(key)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs transition ${
              vehicleType === key
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input text-sm" placeholder="Code" required {...register('code')} />
        <input className="input text-sm" type="number" step="any" placeholder="Hourly ₹" required {...register('hourlyPrice')} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1 text-xs" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

const NewSlotForm = ({
  onSubmit,
  submitting,
}: {
  onSubmit: (v: SlotFormValues) => void;
  submitting: boolean;
}) => {
  const [vehicleType, setVehicleType] = useState('FOUR_WHEELER');
  const { register, handleSubmit, reset } = useForm<SlotFormValues>();
  return (
    <form
      onSubmit={handleSubmit((v) => {
        onSubmit({ code: v.code, vehicleType, hourlyPrice: Number(v.hourlyPrice) });
        reset();
        setVehicleType('FOUR_WHEELER');
      })}
      className="space-y-2"
    >
      <div className="flex gap-1.5">
        {VEHICLE_TYPES.map(([key, { Icon, label }]) => (
          <button
            key={key}
            type="button"
            onClick={() => setVehicleType(key)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs transition ${
              vehicleType === key
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-300'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input className="input text-sm" placeholder="Code (A1) *" required {...register('code')} />
        <input className="input text-sm" type="number" step="any" placeholder="Hourly ₹ *" required {...register('hourlyPrice')} />
        <button className="btn-primary text-sm sm:col-auto col-span-2" disabled={submitting}>
          {submitting ? 'Adding…' : '+ Add Slot'}
        </button>
      </div>
    </form>
  );
};
