/**
 * AddSpacePage — 4-step parking space creation wizard for admins.
 *
 * Entry points:
 *   /spaces/add                              → admin picks a vendor in Step 1
 *   /spaces/add?vendorId=xxx&vendorName=yyy  → vendor pre-selected (from vendor kebab menu)
 *
 * Steps:
 *   1. Space Details  (+ vendor picker when no vendorId in URL)
 *   2. Add Slots
 *   3. Amenities
 *   4. Review & Create
 *
 * Space is created as APPROVED / isActive=true immediately (admin bypass).
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2,
  MapPin, Plus, Trash2, X, Bike, Car, Truck, Building2,
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { api } from '@/lib/api';
import { Dropzone } from '@/components/Dropzone';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SpaceFormValues {
  name:        string;
  addressLine: string;
  city:        string;
  state:       string;
  pincode:     string;
  latitude:    number;
  longitude:   number;
  description?: string;
}

interface SlotDraft {
  uid:          string;
  vehicleType:  'TWO_WHEELER' | 'FOUR_WHEELER' | 'HEAVY';
  code:         string;
  hourlyPrice:  number;
}

interface Amenity {
  id:           string;
  name:         string;
  icon:         string;
  description?: string;
}

// ── Amenity icon lookup ────────────────────────────────────────────────────────
type LucideFC = React.ComponentType<LucideProps>;

const ICON_MAP: Record<string, LucideFC> = {
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Building2, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation, Car, Bike, Truck,
  // Legacy aliases
  Warehouse: SquareParking,
  Shield: ShieldCheck,
  MapPin: Navigation,
  ParkingCircle: SquareParking,
};

const AmenityIcon = ({ icon, className = 'h-5 w-5' }: { icon: string; className?: string }) => {
  if (!icon) return null;
  if (icon.startsWith('http'))
    return <img src={icon} alt="" className={`${className} rounded object-contain`} />;
  const Icon = ICON_MAP[icon] as LucideFC | undefined;
  if (Icon) return <Icon className={className} />;
  return <span className="text-base leading-none">{icon}</span>;
};

// ── Vehicle types ──────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: 'TWO_WHEELER'  as const, label: '2-Wheeler',     Icon: Bike,  desc: 'Bike / Scooter' },
  { value: 'FOUR_WHEELER' as const, label: '4-Wheeler',     Icon: Car,   desc: 'Car / SUV'       },
  { value: 'HEAVY'        as const, label: 'Heavy Vehicle', Icon: Truck, desc: 'Truck / Lorry'   },
];

// ── Google Maps URL parser ─────────────────────────────────────────────────────
const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };
  return null;
};

// ── Stepper ────────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Space Details', 'Add Slots', 'Amenities', 'Review & Create'];

const StepperBar = ({ current }: { current: number }) => (
  <div className="mb-8 flex items-start">
    {STEP_LABELS.map((label, i) => {
      const n      = i + 1;
      const done   = n < current;
      const active = n === current;
      return (
        <div key={n} className="flex flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <div className={`h-0.5 flex-1 transition-colors ${i === 0 ? 'invisible' : done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
              done   ? 'bg-emerald-500 text-white' :
              active ? 'bg-brand-500 text-white shadow-lg shadow-brand-200 dark:shadow-brand-900/30' :
                       'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <div className={`h-0.5 flex-1 transition-colors ${i === STEP_LABELS.length - 1 ? 'invisible' : done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
          </div>
          <span className={`mt-2 hidden text-center text-xs font-medium sm:block ${
            active ? 'text-brand-600 dark:text-brand-400' :
            done   ? 'text-emerald-600 dark:text-emerald-400' :
                     'text-slate-400'
          }`}>
            {label}
          </span>
        </div>
      );
    })}
  </div>
);

// ── Step 1: Space Details (+ optional vendor picker) ──────────────────────────
const Step1 = ({
  defaultValues,
  vendorId,
  vendorName,
  requireVendorPick,
  onVendorChange,
  imagePreviews,
  onAddImages,
  onRemoveImage,
  onNext,
}: {
  defaultValues?:      Partial<SpaceFormValues>;
  vendorId:            string;
  vendorName:          string;
  requireVendorPick:   boolean;
  onVendorChange:      (id: string, name: string) => void;
  imagePreviews:       string[];
  onAddImages:         (files: File[]) => void;
  onRemoveImage:       (idx: number) => void;
  onNext:              (v: SpaceFormValues) => void;
}) => {
  const { register, handleSubmit, setValue, watch } = useForm<SpaceFormValues>({ defaultValues });
  const pincode = watch('pincode');
  const lat     = watch('latitude');
  const lng     = watch('longitude');

  const [pincodeState, setPincodeState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [mapsUrl, setMapsUrl]           = useState('');
  const [mapsError, setMapsError]       = useState('');
  const [vendorErr, setVendorErr]       = useState('');
  const lastPin = useRef('');

  // Fetch approved vendors for picker
  const { data: vendorData } = useQuery({
    queryKey: ['admin-vendors-approved'],
    queryFn: async () => (await api.get('/admin/vendors', { params: { status: 'APPROVED' } })).data,
    enabled: requireVendorPick,
  });
  const approvedVendors: any[] = vendorData?.items ?? [];

  // Pincode → City / State auto-fill
  useEffect(() => {
    const p = (pincode ?? '').replace(/\D/g, '');
    if (p.length !== 6 || p === lastPin.current) return;
    lastPin.current = p;
    setPincodeState('loading');
    fetch(`https://api.postalpincode.in/pincode/${p}`)
      .then((r) => r.json())
      .then((data) => {
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setValue('city',  po.District ?? po.Block ?? po.Name, { shouldDirty: true });
          setValue('state', po.State,                           { shouldDirty: true });
          setPincodeState('found');
        } else {
          setPincodeState('error');
        }
      })
      .catch(() => setPincodeState('error'));
  }, [pincode, setValue]);

  const extractCoords = () => {
    setMapsError('');
    const coords = parseGoogleMapsUrl(mapsUrl.trim());
    if (!coords) {
      setMapsError('Could not find coordinates. Paste the full URL from the address bar (not a short link).');
      return;
    }
    setValue('latitude',  coords.lat, { shouldDirty: true });
    setValue('longitude', coords.lng, { shouldDirty: true });
  };

  const handleNext = handleSubmit((v) => {
    if (requireVendorPick && !vendorId) {
      setVendorErr('Please select a vendor');
      return;
    }
    onNext({ ...v, latitude: Number(v.latitude), longitude: Number(v.longitude) });
  });

  return (
    <form onSubmit={handleNext} className="space-y-5">
      {/* ── Vendor selector (only when not pre-set from URL) ── */}
      {requireVendorPick ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Vendor <span className="text-red-500">*</span>
          </label>
          <select
            className={`input w-full ${vendorErr ? 'border-red-400 focus:ring-red-400' : ''}`}
            value={vendorId}
            onChange={(e) => {
              const sel = approvedVendors.find((v: any) => v.id === e.target.value);
              onVendorChange(e.target.value, sel?.businessName ?? '');
              setVendorErr('');
            }}
          >
            <option value="">— Select a vendor —</option>
            {approvedVendors.map((v: any) => (
              <option key={v.id} value={v.id}>{v.businessName}</option>
            ))}
          </select>
          {vendorErr && <p className="mt-1 text-xs text-red-500">{vendorErr}</p>}
          {approvedVendors.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">No approved vendors found.</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/60">
          <Building2 className="h-4 w-4 shrink-0 text-brand-500" />
          <div>
            <p className="text-[10px] font-medium text-slate-400">Vendor</p>
            <p className="text-sm font-semibold">{vendorName}</p>
          </div>
        </div>
      )}

      {/* Space name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Space / Location Name <span className="text-red-500">*</span></label>
        <input className="input w-full" placeholder="e.g. Green Park Parking" required {...register('name')} />
      </div>

      {/* Pincode → City / State */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Pincode <span className="text-red-500">*</span></label>
          <div className="relative">
            <input className="input w-full pr-7" placeholder="6-digit pincode" maxLength={6} required {...register('pincode')} />
            {pincodeState === 'loading' && <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
            {pincodeState === 'found'   && <CheckCircle2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
          </div>
          {pincodeState === 'error' && <p className="mt-1 text-xs text-red-500">Pincode not found. Fill manually.</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">City / District <span className="text-red-500">*</span></label>
          <input className="input w-full" placeholder="Auto-filled" required {...register('city')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">State <span className="text-red-500">*</span></label>
          <input className="input w-full" placeholder="Auto-filled" required {...register('state')} />
        </div>
      </div>

      {/* Street address */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Street Address <span className="text-red-500">*</span></label>
        <input className="input w-full" placeholder="Building, street, landmark…" required {...register('addressLine')} />
      </div>

      {/* Google Maps → coordinates */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Google Maps Location</label>
        <p className="mb-1.5 text-xs text-slate-400">
          Open the location in Google Maps → copy the URL from the address bar → paste below.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="https://www.google.com/maps/place/.../@lat,lng,..."
            value={mapsUrl}
            onChange={(e) => { setMapsUrl(e.target.value); setMapsError(''); }}
          />
          <button type="button" className="btn-ghost inline-flex shrink-0 items-center gap-1 text-sm" onClick={extractCoords}>
            <MapPin className="h-4 w-4" /> Extract
          </button>
        </div>
        {mapsError && <p className="mt-1 text-xs text-red-500">{mapsError}</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Latitude <span className="text-red-500">*</span></label>
            <input className="input w-full text-sm" type="number" step="any" placeholder="e.g. 17.3850" required {...register('latitude')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Longitude <span className="text-red-500">*</span></label>
            <input className="input w-full text-sm" type="number" step="any" placeholder="e.g. 78.4867" required {...register('longitude')} />
          </div>
        </div>
        {lat && lng && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Coordinates set: {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
        <textarea className="input w-full text-sm" rows={3} placeholder="Parking type, amenities, access instructions… (optional)" {...register('description')} />
      </div>

      {/* Photos */}
      <div>
        <p className="mb-0.5 text-sm font-semibold">Parking Space Photos</p>
        <p className="mb-3 text-xs text-slate-400">Upload photos to help customers identify the space. Up to 10 images. (optional)</p>
        {imagePreviews.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imagePreviews.map((url, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => onRemoveImage(i)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Dropzone
          onFiles={onAddImages}
          hint={`JPEG, PNG or WebP · up to 5 MB each${imagePreviews.length > 0 ? ` · ${imagePreviews.length} selected` : ''}`}
        />
      </div>

      <div className="pt-2">
        <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2">
          Next: Add Slots <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
};

// ── Step 2: Slot builder ───────────────────────────────────────────────────────
const Step2 = ({
  slots, onAddSlot, onRemoveSlot, onBack, onNext,
}: {
  slots:        SlotDraft[];
  onAddSlot:    (s: SlotDraft) => void;
  onRemoveSlot: (uid: string) => void;
  onBack:       () => void;
  onNext:       () => void;
}) => {
  const [vehicleType, setVehicleType] = useState<SlotDraft['vehicleType']>('FOUR_WHEELER');
  const [code,  setCode]  = useState('');
  const [price, setPrice] = useState('');
  const [err,   setErr]   = useState('');

  const addSlot = () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode)                       { setErr('Slot code is required'); return; }
    if (!price || Number(price) <= 0)       { setErr('Enter a valid hourly price (must be > 0)'); return; }
    if (slots.some((s) => s.code === trimmedCode)) { setErr(`Slot "${trimmedCode}" already exists`); return; }
    onAddSlot({ uid: Math.random().toString(36).slice(2), vehicleType, code: trimmedCode, hourlyPrice: Number(price) });
    setCode(''); setPrice(''); setErr('');
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <p className="text-sm font-semibold">Add a Parking Slot</p>

        {/* Vehicle type picker */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-500">Vehicle Type <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map((vt) => {
              const active = vehicleType === vt.value;
              return (
                <button key={vt.value} type="button" onClick={() => setVehicleType(vt.value)}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}>
                  <div className="flex justify-center">
                    <vt.Icon className={`h-7 w-7 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  </div>
                  <p className={`mt-1.5 text-xs font-semibold ${active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>{vt.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{vt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code + price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slot Code <span className="text-red-500">*</span></label>
            <input className="input w-full" placeholder="e.g. A1, B2" value={code}
              onChange={(e) => { setCode(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSlot())} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Hourly Rate (₹) <span className="text-red-500">*</span></label>
            <input className="input w-full" type="number" step="any" min="1" placeholder="e.g. 30" value={price}
              onChange={(e) => { setPrice(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSlot())} />
          </div>
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <button type="button" onClick={addSlot} className="btn-primary w-full inline-flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Add Slot
        </button>
      </div>

      {/* Added slots list */}
      {slots.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {slots.length} slot{slots.length !== 1 ? 's' : ''} added
          </p>
          <div className="space-y-2">
            {slots.map((s) => {
              const vt = VEHICLE_TYPES.find((v) => v.value === s.vehicleType)!;
              return (
                <div key={s.uid} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <vt.Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{s.code}</p>
                    <p className="text-xs text-slate-400">{vt.label} · ₹{s.hourlyPrice}/hr</p>
                  </div>
                  <button type="button" onClick={() => onRemoveSlot(s.uid)}
                    className="shrink-0 text-slate-400 transition hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-400">No slots added yet</p>
          <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">Add at least one slot to proceed.</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="btn-ghost inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" disabled={slots.length === 0}
          onClick={() => { if (slots.length === 0) { setErr('Add at least one slot to continue.'); return; } onNext(); }}
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50">
          Next: Amenities <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 3: Amenity selection ──────────────────────────────────────────────────
const Step3 = ({
  selectedIds, onToggle, onBack, onNext,
}: {
  selectedIds: Set<string>;
  onToggle:    (id: string) => void;
  onBack:      () => void;
  onNext:      () => void;
}) => {
  const { data, isLoading, isError, refetch } = useQuery<{ items: Amenity[] }>({
    queryKey: ['admin-amenities'],
    queryFn:  async () => (await api.get('/admin/amenities')).data,
    staleTime: 60_000,
  });
  const amenities = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">What amenities does this space offer?</p>
        <p className="mt-0.5 text-xs text-slate-400">Select all that apply. Can be changed later.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 px-6 py-10 text-center dark:border-red-800/40">
          <p className="text-sm font-medium text-red-500">Could not load amenities.</p>
          <button type="button" onClick={() => refetch()} className="mt-3 text-xs font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400">
            Retry
          </button>
        </div>
      ) : amenities.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-400">No amenities configured yet.</p>
          <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">You can add amenities from the Amenities page, then edit this space.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {amenities.map((a) => {
            const selected = selectedIds.has(a.id);
            return (
              <button key={a.id} type="button" onClick={() => onToggle(a.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition ${
                  selected
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                )}
                <AmenityIcon icon={a.icon} className="h-6 w-6" />
                <p className={`mt-2 text-xs font-semibold ${selected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {a.name}
                </p>
                {a.description && <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{a.description}</p>}
              </button>
            );
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <p className="text-xs text-brand-600 dark:text-brand-400">
          ✓ {selectedIds.size} amenit{selectedIds.size === 1 ? 'y' : 'ies'} selected
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="btn-ghost inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onNext} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
          Preview & Create <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 4: Review + submit ────────────────────────────────────────────────────
const Step4 = ({
  spaceData, vendorName, imagePreviews, slots, selectedAmenityIds,
  submitting, error, onBack, onSubmit,
}: {
  spaceData:           SpaceFormValues;
  vendorName:          string;
  imagePreviews:       string[];
  slots:               SlotDraft[];
  selectedAmenityIds:  Set<string>;
  submitting:          boolean;
  error:               string | null;
  onBack:              () => void;
  onSubmit:            () => void;
}) => {
  const { data: amenityData } = useQuery<{ items: Amenity[] }>({
    queryKey: ['admin-amenities'],
    queryFn:  async () => (await api.get('/admin/amenities')).data,
    staleTime: 60_000,
  });
  const chosenAmenities = (amenityData?.items ?? []).filter((a) => selectedAmenityIds.has(a.id));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Review everything below. The space will be <strong>created and immediately published</strong> — no approval needed.
      </p>

      {/* Vendor + Space details */}
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Space Details</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Vendor</dt>
            <dd className="font-semibold">{vendorName}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Space Name</dt>
            <dd className="font-semibold">{spaceData.name}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Pincode</dt>
            <dd>{spaceData.pincode}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">City, State</dt>
            <dd>{spaceData.city}, {spaceData.state}</dd>
          </div>
          <div className="col-span-2">
            <dt className="mb-0.5 text-xs text-slate-400">Street Address</dt>
            <dd>{spaceData.addressLine}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Latitude</dt>
            <dd className="font-mono text-xs">{Number(spaceData.latitude).toFixed(6)}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Longitude</dt>
            <dd className="font-mono text-xs">{Number(spaceData.longitude).toFixed(6)}</dd>
          </div>
          {spaceData.description && (
            <div className="col-span-2">
              <dt className="mb-0.5 text-xs text-slate-400">Description</dt>
              <dd className="text-slate-600 dark:text-slate-300">{spaceData.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Photos */}
      {imagePreviews.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Photos ({imagePreviews.length})</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imagePreviews.map((url, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slots */}
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Slots ({slots.length})</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {slots.map((s) => {
            const vt = VEHICLE_TYPES.find((v) => v.value === s.vehicleType)!;
            return (
              <div key={s.uid} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <vt.Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{s.code}</p>
                  <p className="text-xs text-slate-400">{vt.label} · ₹{s.hourlyPrice}/hr</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Amenities */}
      {chosenAmenities.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Amenities ({chosenAmenities.length})</h3>
          <div className="flex flex-wrap gap-2">
            {chosenAmenities.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300">
                <AmenityIcon icon={a.icon} className="h-3.5 w-3.5" /> {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} disabled={submitting} className="btn-ghost inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting}
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating Space…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Create Space</>
          )}
        </button>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const AddSpacePage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  // Pre-fill vendor from URL (when navigating from vendor kebab menu)
  const [vendorId,   setVendorId]   = useState(searchParams.get('vendorId')   ?? '');
  const [vendorName, setVendorName] = useState(searchParams.get('vendorName') ?? '');
  const requireVendorPick = !searchParams.get('vendorId'); // show picker only when no pre-set

  const [step,               setStep]               = useState<1 | 2 | 3 | 4>(1);
  const [spaceData,          setSpaceData]          = useState<SpaceFormValues | null>(null);
  const [imageFiles,         setImageFiles]         = useState<File[]>([]);
  const [imagePreviews,      setImagePreviews]      = useState<string[]>([]);
  const [slots,              setSlots]              = useState<SlotDraft[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<string>>(new Set());
  const [submitting,         setSubmitting]         = useState(false);
  const [error,              setError]              = useState<string | null>(null);

  // Revoke object URLs on unmount
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = imagePreviews;
  useEffect(() => () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const addImages = (files: File[]) => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...urls]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!spaceData || !vendorId) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the location (admin endpoint — auto-approved)
      const { data: loc } = await api.post('/admin/locations', { ...spaceData, vendorId });
      const locationId: string = loc.id;

      // 2. Upload images (if any)
      if (imageFiles.length > 0) {
        const form = new FormData();
        imageFiles.forEach((f) => form.append('files', f));
        await api.post(`/admin/locations/${locationId}/images`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3. Create each slot
      for (const slot of slots) {
        await api.post(`/admin/locations/${locationId}/slots`, {
          code:         slot.code,
          vehicleType:  slot.vehicleType,
          hourlyPrice:  slot.hourlyPrice,
        });
      }

      // 4. Set amenities
      if (selectedAmenityIds.size > 0) {
        await api.put(`/admin/locations/${locationId}/amenities`, {
          amenityIds: [...selectedAmenityIds],
        });
      }

      qc.invalidateQueries({ queryKey: ['admin-spaces'] });
      navigate('/spaces', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Creation failed. Please check your details and try again.');
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    else navigate(-1);
  };

  return (
    <section className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <button className="btn-ghost mt-1 inline-flex items-center gap-1 text-sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          {step > 1 ? 'Back' : 'Cancel'}
        </button>
        <div>
          <h1 className="text-2xl font-bold">Add Parking Space</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Complete all 4 steps. The space will be published immediately.
          </p>
        </div>
      </div>

      <StepperBar current={step} />

      <div className="card p-6">
        {step === 1 && (
          <Step1
            defaultValues={spaceData ?? undefined}
            vendorId={vendorId}
            vendorName={vendorName}
            requireVendorPick={requireVendorPick}
            onVendorChange={(id, name) => { setVendorId(id); setVendorName(name); }}
            imagePreviews={imagePreviews}
            onAddImages={addImages}
            onRemoveImage={removeImage}
            onNext={(v) => { setSpaceData(v); setStep(2); }}
          />
        )}

        {step === 2 && (
          <Step2
            slots={slots}
            onAddSlot={(s) => setSlots((prev) => [...prev, s])}
            onRemoveSlot={(uid) => setSlots((prev) => prev.filter((s) => s.uid !== uid))}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3
            selectedIds={selectedAmenityIds}
            onToggle={toggleAmenity}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && spaceData && (
          <Step4
            spaceData={spaceData}
            vendorName={vendorName}
            imagePreviews={imagePreviews}
            slots={slots}
            selectedAmenityIds={selectedAmenityIds}
            submitting={submitting}
            error={error}
            onBack={() => setStep(3)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </section>
  );
};
