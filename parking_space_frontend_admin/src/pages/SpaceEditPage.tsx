import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, MapPin, Loader2, CheckCircle2, Trash2,
  Bike, Car, Truck, Plus, UploadCloud,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Dropzone } from '@/components/Dropzone';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Amenity { id: string; name: string; icon: string; description?: string }
interface LocationImage { id: string; url: string; sortOrder: number }
interface Slot {
  id: string; code: string; vehicleType: string;
  hourlyPrice: number; monthlyPrice?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}
interface Space {
  id: string; name: string; description?: string;
  addressLine: string; city: string; state: string; pincode: string;
  latitude: number; longitude: number;
  approvalStatus: string; isActive: boolean;
  vendor: { businessName: string; user: { fullName: string; email: string } };
  images: LocationImage[];
  slots: Slot[];
  amenities: { amenityId: string; amenity: Amenity }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  return null;
};

const VT_OPTIONS = [
  { value: 'TWO_WHEELER',  label: '2-Wheeler',     Icon: Bike  },
  { value: 'FOUR_WHEELER', label: '4-Wheeler (Car)', Icon: Car   },
  { value: 'HEAVY',        label: 'Heavy Vehicle',  Icon: Truck },
] as const;

const VT_MAP: Record<string, { Icon: typeof Car; label: string }> = {
  TWO_WHEELER:  { Icon: Bike,  label: '2-Wheeler' },
  FOUR_WHEELER: { Icon: Car,   label: '4-Wheeler' },
  HEAVY:        { Icon: Truck, label: 'Heavy' },
  CAR:          { Icon: Car,   label: '4-Wheeler' },
};

// ── Section wrapper ────────────────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card p-5">
    <h2 className="mb-4 text-base font-semibold">{title}</h2>
    {children}
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export const SpaceEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Fetch space details ────────────────────────────────────────────────────
  const { data: space, isLoading } = useQuery<Space>({
    queryKey: ['admin-space', id],
    queryFn: async () => (await api.get(`/admin/spaces/${id}`)).data,
    enabled: !!id,
  });

  // ── Fetch amenities master list ────────────────────────────────────────────
  const { data: amenityData } = useQuery<{ items: Amenity[] }>({
    queryKey: ['admin-amenities'],
    queryFn: async () => (await api.get('/admin/amenities')).data,
  });
  const allAmenities = amenityData?.items ?? [];

  // ── Basic details form ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', description: '', addressLine: '', city: '',
    state: '', pincode: '', latitude: '', longitude: '',
  });
  const [mapsUrl, setMapsUrl]       = useState('');
  const [mapsError, setMapsError]   = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<'idle'|'loading'|'found'|'error'>('idle');
  const pincodeRef = useRef('');
  const [detailsSaved, setDetailsSaved] = useState(false);

  // ── Amenities selection ────────────────────────────────────────────────────
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());

  // ── New slot form ──────────────────────────────────────────────────────────
  const [newSlot, setNewSlot] = useState({
    code: '', vehicleType: 'FOUR_WHEELER', hourlyPrice: '', monthlyPrice: '',
  });
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotEdit, setSlotEdit] = useState({
    code: '', vehicleType: '', hourlyPrice: '', monthlyPrice: '',
  });

  // ── Image upload ───────────────────────────────────────────────────────────
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const pendingRef = useRef<string[]>([]);
  pendingRef.current = pendingPreviews;
  useEffect(() => () => { pendingRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Populate form when space loads
  useEffect(() => {
    if (!space) return;
    setForm({
      name:        space.name,
      description: space.description ?? '',
      addressLine: space.addressLine,
      city:        space.city,
      state:       space.state,
      pincode:     space.pincode,
      latitude:    String(space.latitude),
      longitude:   String(space.longitude),
    });
    setSelectedAmenities(new Set(space.amenities.map((a) => a.amenityId)));
  }, [space]);

  // Pincode auto-fill
  useEffect(() => {
    const p = form.pincode.replace(/\D/g, '');
    if (p.length !== 6 || p === pincodeRef.current) return;
    pincodeRef.current = p;
    setPincodeStatus('loading');
    // Proxied through our backend (third-party API has frequent SSL cert issues)
    api.get(`/util/pincode/${p}`)
      .then(({ data }) => {
        if (data?.city && data?.state) {
          setForm((f) => ({ ...f, city: data.city, state: data.state }));
          setPincodeStatus('found');
        } else {
          setPincodeStatus('error');
        }
      })
      .catch(() => setPincodeStatus('error'));
  }, [form.pincode]);

  const handleExtractCoords = () => {
    setMapsError('');
    const coords = parseGoogleMapsUrl(mapsUrl.trim());
    if (!coords) {
      setMapsError('Could not find coordinates. Paste the full URL from the address bar.');
      return;
    }
    setForm((f) => ({ ...f, latitude: String(coords.lat), longitude: String(coords.lng) }));
  };

  const invalidateSpace = () => qc.invalidateQueries({ queryKey: ['admin-space', id] });
  const invalidateSpaces = () => qc.invalidateQueries({ queryKey: ['admin-spaces'] });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveDetails = useMutation({
    mutationFn: () => api.patch(`/admin/spaces/${id}`, {
      ...form,
      latitude:  Number(form.latitude),
      longitude: Number(form.longitude),
    }),
    onSuccess: () => {
      invalidateSpace(); invalidateSpaces();
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2500);
    },
  });

  const uploadImages = useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return (await api.post(`/admin/locations/${id}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
    onSuccess: () => {
      pendingPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPendingPreviews([]);
      invalidateSpace();
    },
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => api.delete(`/admin/locations/${id}/images/${imageId}`),
    onSuccess: invalidateSpace,
  });

  const saveAmenities = useMutation({
    mutationFn: () =>
      api.put(`/admin/locations/${id}/amenities`, { amenityIds: [...selectedAmenities] }),
    onSuccess: () => { invalidateSpace(); invalidateSpaces(); },
  });

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
      setNewSlot({ code: '', vehicleType: 'FOUR_WHEELER', hourlyPrice: '', monthlyPrice: '' });
      invalidateSpace(); invalidateSpaces();
    },
  });

  const updateSlot = useMutation({
    mutationFn: ({ slotId }: { slotId: string }) => {
      const mp = slotEdit.monthlyPrice.trim();
      return api.patch(`/admin/slots/${slotId}`, {
        code:         slotEdit.code.trim(),
        vehicleType:  slotEdit.vehicleType,
        hourlyPrice:  Number(slotEdit.hourlyPrice),
        monthlyPrice: mp === '' ? null : Number(mp),
      });
    },
    onSuccess: () => { setEditingSlot(null); invalidateSpace(); invalidateSpaces(); },
  });

  const toggleSlotStatus = useMutation({
    mutationFn: ({ slotId, status }: { slotId: string; status: string }) =>
      api.patch(`/admin/slots/${slotId}/status`, { status }),
    onSuccess: () => { invalidateSpace(); invalidateSpaces(); },
  });

  const deleteSlot = useMutation({
    mutationFn: (slotId: string) => api.delete(`/admin/slots/${slotId}`),
    onSuccess: () => { invalidateSpace(); invalidateSpaces(); },
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="p-6 text-center text-slate-500">Space not found.</div>
    );
  }

  const images = [...(space.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/spaces')}
          className="btn-ghost mt-0.5 flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Spaces
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{space.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {space.vendor?.businessName} &mdash; {space.vendor?.user?.email}
        </p>
      </div>

      {/* ── 1. Basic Details ───────────────────────────────────────────────── */}
      <Section title="Basic Details">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Space / Business Name *</label>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
            <textarea
              className="input w-full text-sm"
              rows={3}
              placeholder="Parking type, access instructions, highlights…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Pincode / City / State */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pincode *</label>
              <div className="relative">
                <input
                  className="input w-full pr-7"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => { setForm((f) => ({ ...f, pincode: e.target.value })); setPincodeStatus('idle'); }}
                />
                {pincodeStatus === 'loading' && (
                  <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                {pincodeStatus === 'found' && (
                  <CheckCircle2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
              {pincodeStatus === 'error' && (
                <p className="mt-1 text-xs text-red-500">Not found — fill manually.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">City / District *</label>
              <input
                className="input w-full"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">State *</label>
              <input
                className="input w-full"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Street Address *</label>
            <input
              className="input w-full"
              placeholder="Building, street, landmark…"
              value={form.addressLine}
              onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
            />
          </div>

          {/* Google Maps / Coordinates */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Google Maps Location</label>
            <p className="mb-1.5 text-xs text-slate-400">
              Open location in Google Maps → copy URL → paste below to auto-extract coordinates.
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="https://www.google.com/maps/place/.../@lat,lng,..."
                value={mapsUrl}
                onChange={(e) => { setMapsUrl(e.target.value); setMapsError(''); }}
              />
              <button
                type="button"
                className="btn-ghost inline-flex shrink-0 items-center gap-1 text-sm"
                onClick={handleExtractCoords}
              >
                <MapPin className="h-4 w-4" /> Extract
              </button>
            </div>
            {mapsError && <p className="mt-1 text-xs text-red-500">{mapsError}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Latitude *</label>
                <input
                  className="input w-full text-sm"
                  type="number"
                  step="any"
                  placeholder="e.g. 17.3850"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Longitude *</label>
                <input
                  className="input w-full text-sm"
                  type="number"
                  step="any"
                  placeholder="e.g. 78.4867"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>
            {form.latitude && form.longitude && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                ✓ {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              disabled={saveDetails.isPending}
              onClick={() => saveDetails.mutate()}
            >
              <Save className="h-4 w-4" />
              {saveDetails.isPending ? 'Saving…' : 'Save Details'}
            </button>
            {detailsSaved && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            {saveDetails.isError && (
              <span className="text-sm text-red-500">
                {(saveDetails.error as any)?.response?.data?.message ?? 'Save failed'}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* ── 2. Images ─────────────────────────────────────────────────────────── */}
      <Section title="Photos">
        {(images.length > 0 || pendingPreviews.length > 0) && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                <button
                  onClick={() => {
                    if (confirm('Delete this photo?')) deleteImage.mutate(img.id);
                  }}
                  disabled={deleteImage.isPending}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploadImages.isPending &&
              pendingPreviews.map((url, i) => (
                <div
                  key={`p-${i}`}
                  className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-brand-400 bg-slate-50 dark:bg-slate-800"
                >
                  <img src={url} alt="" className="h-full w-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                  </div>
                </div>
              ))}
          </div>
        )}
        <Dropzone
          disabled={uploadImages.isPending}
          hint={
            uploadImages.isPending
              ? `Uploading ${pendingPreviews.length} image${pendingPreviews.length !== 1 ? 's' : ''}…`
              : `JPEG, PNG or WebP · up to 5 MB each${images.length > 0 ? ` · ${images.length} uploaded` : ''}`
          }
          onFiles={(files) => {
            setPendingPreviews(files.map((f) => URL.createObjectURL(f)));
            uploadImages.mutate(files);
          }}
        />
        {uploadImages.isError && (
          <p className="mt-2 text-xs text-rose-600">
            Upload failed — {(uploadImages.error as any)?.response?.data?.message ?? 'please try again.'}
          </p>
        )}
      </Section>

      {/* ── 3. Slots ──────────────────────────────────────────────────────────── */}
      <Section title="Parking Slots">
        <div className="space-y-2">
          {(space.slots ?? []).map((slot) => {
            const vt  = VT_MAP[slot.vehicleType] ?? { Icon: Car, label: slot.vehicleType };
            const isEd = editingSlot === slot.id;
            return (
              <div key={slot.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                {/* Slot row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <vt.Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-mono">{slot.code}</p>
                    <p className="text-xs text-slate-400">
                      {vt.label} · ₹{Number(slot.hourlyPrice).toLocaleString('en-IN')}/hr
                      {slot.monthlyPrice != null && Number(slot.monthlyPrice) > 0 && (
                        <> · ₹{Number(slot.monthlyPrice).toLocaleString('en-IN')}/mo</>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    slot.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {slot.status}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="btn-ghost text-xs px-2 py-1"
                      onClick={() => {
                        if (isEd) { setEditingSlot(null); return; }
                        setEditingSlot(slot.id);
                        setSlotEdit({
                          code:         slot.code,
                          vehicleType:  slot.vehicleType,
                          hourlyPrice:  String(slot.hourlyPrice),
                          monthlyPrice: slot.monthlyPrice != null ? String(slot.monthlyPrice) : '',
                        });
                      }}
                    >
                      {isEd ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      className={`btn-ghost text-xs px-2 py-1 ${
                        slot.status === 'ACTIVE' ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      disabled={toggleSlotStatus.isPending}
                      onClick={() =>
                        toggleSlotStatus.mutate({
                          slotId: slot.id,
                          status: slot.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      {slot.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-ghost text-xs px-2 py-1 text-red-500 hover:text-red-700 dark:text-red-400"
                      disabled={deleteSlot.isPending}
                      onClick={() => {
                        if (confirm(`Delete slot "${slot.code}"? This will also cancel any future bookings.`))
                          deleteSlot.mutate(slot.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit */}
                {isEd && (
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Slot Code</label>
                        <input
                          className="input w-full text-sm"
                          value={slotEdit.code}
                          onChange={(e) => setSlotEdit((s) => ({ ...s, code: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Vehicle Type</label>
                        <select
                          className="input w-full text-sm"
                          value={slotEdit.vehicleType}
                          onChange={(e) => setSlotEdit((s) => ({ ...s, vehicleType: e.target.value }))}
                        >
                          {VT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Price / hr (₹)</label>
                        <input
                          type="number"
                          min="0"
                          className="input w-full text-sm"
                          value={slotEdit.hourlyPrice}
                          onChange={(e) => setSlotEdit((s) => ({ ...s, hourlyPrice: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Monthly (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Optional"
                          className="input w-full text-sm"
                          value={slotEdit.monthlyPrice}
                          onChange={(e) => setSlotEdit((s) => ({ ...s, monthlyPrice: e.target.value }))}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Monthly = 30-day subscription pass. Leave blank to disable monthly bookings for this slot.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-primary text-xs"
                        disabled={updateSlot.isPending}
                        onClick={() => updateSlot.mutate({ slotId: slot.id })}
                      >
                        {updateSlot.isPending ? 'Saving…' : 'Save Slot'}
                      </button>
                      <button className="btn-ghost text-xs" onClick={() => setEditingSlot(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new slot */}
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Add New Slot</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Slot Code *</label>
              <input
                className="input w-full text-sm"
                placeholder="e.g. A1, B2"
                value={newSlot.code}
                onChange={(e) => setNewSlot((s) => ({ ...s, code: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Vehicle Type *</label>
              <select
                className="input w-full text-sm"
                value={newSlot.vehicleType}
                onChange={(e) => setNewSlot((s) => ({ ...s, vehicleType: e.target.value }))}
              >
                {VT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Price / hr (₹) *</label>
              <input
                type="number"
                min="0"
                className="input w-full text-sm"
                placeholder="e.g. 30"
                value={newSlot.hourlyPrice}
                onChange={(e) => setNewSlot((s) => ({ ...s, hourlyPrice: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Monthly Pass (₹)</label>
              <input
                type="number"
                min="0"
                className="input w-full text-sm"
                placeholder="Optional"
                value={newSlot.monthlyPrice}
                onChange={(e) => setNewSlot((s) => ({ ...s, monthlyPrice: e.target.value }))}
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Monthly Pass enables a 30-day subscription option for this slot. Leave blank for hourly-only.
          </p>
          <button
            className="btn-primary mt-3 inline-flex items-center gap-1.5 text-sm"
            disabled={addSlot.isPending || !newSlot.code || !newSlot.hourlyPrice}
            onClick={() => addSlot.mutate()}
          >
            <Plus className="h-4 w-4" />
            {addSlot.isPending ? 'Adding…' : 'Add Slot'}
          </button>
          {addSlot.isError && (
            <p className="mt-2 text-xs text-red-500">
              {(addSlot.error as any)?.response?.data?.message ?? 'Failed to add slot'}
            </p>
          )}
        </div>
      </Section>

      {/* ── 4. Amenities ──────────────────────────────────────────────────────── */}
      <Section title="Amenities">
        {allAmenities.length === 0 ? (
          <p className="text-sm text-slate-400">No amenities configured yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allAmenities.map((a) => {
                const checked = selectedAmenities.has(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      checked
                        ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                        : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={checked}
                      onChange={() =>
                        setSelectedAmenities((prev) => {
                          const next = new Set(prev);
                          checked ? next.delete(a.id) : next.add(a.id);
                          return next;
                        })
                      }
                    />
                    <span className={`text-sm font-medium ${checked ? 'text-brand-700 dark:text-brand-300' : ''}`}>
                      {a.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                disabled={saveAmenities.isPending}
                onClick={() => saveAmenities.mutate()}
              >
                <Save className="h-4 w-4" />
                {saveAmenities.isPending ? 'Saving…' : 'Save Amenities'}
              </button>
              {saveAmenities.isSuccess && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </>
        )}
      </Section>
    </div>
  );
};
