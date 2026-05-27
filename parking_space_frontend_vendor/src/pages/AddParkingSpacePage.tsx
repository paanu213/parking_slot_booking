import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
  Bike,
  Car,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Dropzone } from '@/components/Dropzone';
import { AmenityIcon } from '@/components/AmenityIcon';
import { type SpaceFormValues } from '@/features/SpaceForm';

// ── Vehicle type catalogue ────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: 'TWO_WHEELER', label: '2-Wheeler', Icon: Bike, desc: 'Bike / Scooter' },
  { value: 'FOUR_WHEELER', label: '4-Wheeler', Icon: Car,  desc: 'Car / SUV' },
  { value: 'HEAVY',        label: 'Heavy Vehicle', Icon: Truck, desc: 'Truck / Lorry' },
] as const;

type VehicleType = (typeof VEHICLE_TYPES)[number]['value'];

interface SlotDraft {
  uid: string;
  vehicleType: VehicleType;
  code: string;
  hourlyPrice: number;
  monthlyPrice?: number | null;
}

// ── Stepper indicator ─────────────────────────────────────────────────────────
const STEP_LABELS = ['Space Details', 'Add Slots', 'Amenities', 'Review & Submit'];

const StepperBar = ({ current }: { current: number }) => (
  <div className="mb-8 flex items-start">
    {STEP_LABELS.map((label, i) => {
      const n = i + 1;
      const done = n < current;
      const active = n === current;
      return (
        <div key={n} className="flex flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <div
              className={`h-0.5 flex-1 transition-colors ${
                i === 0
                  ? 'invisible'
                  : done
                  ? 'bg-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-200 dark:shadow-brand-900/30'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <div
              className={`h-0.5 flex-1 transition-colors ${
                i === STEP_LABELS.length - 1
                  ? 'invisible'
                  : done
                  ? 'bg-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          </div>
          <span
            className={`mt-2 hidden text-center text-xs font-medium sm:block ${
              active
                ? 'text-brand-600 dark:text-brand-400'
                : done
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {label}
          </span>
        </div>
      );
    })}
  </div>
);

// ── Google Maps URL parser ────────────────────────────────────────────────────
const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };
  return null;
};

// ── Step 1: Space details + photos ────────────────────────────────────────────
const Step1 = ({
  defaultValues,
  imagePreviews,
  onAddImages,
  onRemoveImage,
  onNext,
}: {
  defaultValues?: Partial<SpaceFormValues>;
  imagePreviews: string[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (idx: number) => void;
  onNext: (v: SpaceFormValues) => void;
}) => {
  const { register, handleSubmit, setValue, watch } = useForm<SpaceFormValues>({
    defaultValues,
  });
  const pincode = watch('pincode');
  const lat = watch('latitude');
  const lng = watch('longitude');

  const [pincodeState, setPincodeState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [areas, setAreas]               = useState<string[]>([]);
  const [mapsUrl, setMapsUrl]           = useState('');
  const [mapsError, setMapsError]       = useState('');
  const lastPin = useRef('');

  useEffect(() => {
    const p = (pincode ?? '').replace(/\D/g, '');
    if (p.length !== 6 || p === lastPin.current) return;
    lastPin.current = p;
    setPincodeState('loading');
    setAreas([]);
    setValue('area', '', { shouldDirty: true });

    // Backend proxy (avoids the third-party API's frequent SSL cert issues).
    // Falls back to zippopotam.us if our proxy is unreachable.
    api.get(`/util/pincode/${p}`)
      .then(({ data }) => {
        if (!data?.city || !data?.state) throw new Error('not found');
        setValue('city',  data.city,  { shouldDirty: true });
        setValue('state', data.state, { shouldDirty: true });
        const places = Array.isArray(data.places) ? data.places : [];
        setAreas(places.length ? places.map((p: any) => p.name) : [data.area].filter(Boolean));
        setPincodeState('found');
      })
      .catch(() => {
        // Fallback: zippopotam.us (used only if our backend is unreachable)
        fetch(`https://api.zippopotam.us/in/${p}`)
          .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
          .then((data) => {
            if (data.places?.length > 0) {
              const place = data.places[0];
              setValue('city',  place['place name'], { shouldDirty: true });
              setValue('state', place['state'],      { shouldDirty: true });
              setAreas([place['place name']]);
              setPincodeState('found');
            } else {
              setPincodeState('error');
            }
          })
          .catch(() => setPincodeState('error'));
      });
  }, [pincode, setValue]);

  const extractCoords = () => {
    setMapsError('');
    const coords = parseGoogleMapsUrl(mapsUrl.trim());
    if (!coords) {
      setMapsError(
        'Could not find coordinates. Paste the full URL from the address bar (not a short link).',
      );
      return;
    }
    setValue('latitude', coords.lat, { shouldDirty: true });
    setValue('longitude', coords.lng, { shouldDirty: true });
  };

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onNext({ ...v, latitude: Number(v.latitude), longitude: Number(v.longitude) }),
      )}
      className="space-y-5"
    >
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Space / Business Name *
        </label>
        <input
          className="input w-full"
          placeholder="e.g. Green Park Parking"
          required
          {...register('name')}
        />
      </div>

      {/* Pincode → City + State (read-only) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Pincode *</label>
          <div className="relative">
            <input
              className="input w-full pr-7"
              placeholder="6-digit pincode"
              maxLength={6}
              required
              {...register('pincode')}
            />
            {pincodeState === 'loading' && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {pincodeState === 'found' && (
              <CheckCircle2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            )}
          </div>
          {pincodeState === 'error' && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Pincode not found — please fill city &amp; state below manually.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            City / District
            {pincodeState !== 'found' && <span className="ml-1 font-normal text-slate-400">*</span>}
          </label>
          <input
            className={`input w-full ${pincodeState === 'found' ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
            placeholder={pincodeState === 'found' ? '' : 'Enter city / district'}
            required
            {...register('city')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            State
            {pincodeState !== 'found' && <span className="ml-1 font-normal text-slate-400">*</span>}
          </label>
          <input
            className={`input w-full ${pincodeState === 'found' ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
            placeholder={pincodeState === 'found' ? '' : 'Enter state'}
            required
            {...register('state')}
          />
        </div>
      </div>

      {/* Area — from Post Office API */}
      {areas.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Area *
            <span className="ml-1.5 font-normal text-slate-400">
              ({areas.length} area{areas.length !== 1 ? 's' : ''} found for this pincode)
            </span>
          </label>
          <select className="input w-full" required {...register('area')}>
            <option value="">Select the area your space belongs to…</option>
            {areas.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Street address */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Street Address *</label>
        <input
          className="input w-full"
          placeholder="Building, street, landmark…"
          required
          {...register('addressLine')}
        />
      </div>

      {/* Google Maps → lat/lng */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Google Maps Location
        </label>
        <p className="mb-1.5 text-xs text-slate-400">
          Open your location on Google Maps → copy the URL from the address bar → paste below.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="https://www.google.com/maps/place/.../@lat,lng,..."
            value={mapsUrl}
            onChange={(e) => {
              setMapsUrl(e.target.value);
              setMapsError('');
            }}
          />
          <button
            type="button"
            className="btn-ghost inline-flex shrink-0 items-center gap-1 text-sm"
            onClick={extractCoords}
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
              required
              {...register('latitude')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Longitude *</label>
            <input
              className="input w-full text-sm"
              type="number"
              step="any"
              placeholder="e.g. 78.4867"
              required
              {...register('longitude')}
            />
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
        <textarea
          className="input w-full text-sm"
          rows={3}
          placeholder="Parking type, amenities, access instructions for drivers… (optional)"
          {...register('description')}
        />
      </div>

      {/* Photos */}
      <div>
        <p className="mb-0.5 text-sm font-semibold">Parking Space Photos</p>
        <p className="mb-3 text-xs text-slate-400">
          Help customers identify your space with photos. Up to 10 images. (optional)
        </p>
        {imagePreviews.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imagePreviews.map((url, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600"
                  aria-label="Remove photo"
                >
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
        <button
          type="submit"
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          Next: Add Slots <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
};

// ── Step 2: Slot builder ──────────────────────────────────────────────────────
const Step2 = ({
  slots,
  onAddSlot,
  onRemoveSlot,
  onBack,
  onNext,
}: {
  slots: SlotDraft[];
  onAddSlot: (s: SlotDraft) => void;
  onRemoveSlot: (uid: string) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const [vehicleType, setVehicleType] = useState<VehicleType>('FOUR_WHEELER');
  const [code, setCode]       = useState('');
  const [price, setPrice]     = useState('');
  const [monthly, setMonthly] = useState('');
  const [err, setErr]         = useState('');

  const addSlot = () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setErr('Slot code is required');
      return;
    }
    if (!price || Number(price) <= 0) {
      setErr('Enter a valid hourly price (must be > 0)');
      return;
    }
    if (monthly && Number(monthly) < 0) {
      setErr('Monthly price cannot be negative');
      return;
    }
    if (slots.some((s) => s.code === trimmedCode)) {
      setErr(`Slot "${trimmedCode}" already exists`);
      return;
    }
    onAddSlot({
      uid:          Math.random().toString(36).slice(2),
      vehicleType,
      code:         trimmedCode,
      hourlyPrice:  Number(price),
      monthlyPrice: monthly ? Number(monthly) : null,
    });
    setCode('');
    setPrice('');
    setMonthly('');
    setErr('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSlot();
    }
  };

  return (
    <div className="space-y-5">
      {/* Slot builder card */}
      <div className="space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <p className="text-sm font-semibold">Add a Parking Slot</p>

        {/* Vehicle type picker */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-500">Vehicle Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map((vt) => {
              const active = vehicleType === vt.value;
              return (
                <button
                  key={vt.value}
                  type="button"
                  onClick={() => setVehicleType(vt.value)}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-center">
                    <vt.Icon
                      className={`h-7 w-7 ${
                        active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-xs font-semibold ${
                      active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {vt.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{vt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code + prices */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Slot Code *</label>
            <input
              className="input w-full"
              placeholder="e.g. A1, B2"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setErr('');
              }}
              onKeyDown={handleKey}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Hourly Rate (₹) *
            </label>
            <input
              className="input w-full"
              type="number"
              step="any"
              min="1"
              placeholder="e.g. 30"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setErr('');
              }}
              onKeyDown={handleKey}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Monthly Pass (₹)
            </label>
            <input
              className="input w-full"
              type="number"
              step="any"
              min="0"
              placeholder="Optional"
              value={monthly}
              onChange={(e) => {
                setMonthly(e.target.value);
                setErr('');
              }}
              onKeyDown={handleKey}
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Monthly Pass enables a 30-day subscription option for this slot. Leave blank for hourly-only.
        </p>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <button
          type="button"
          onClick={addSlot}
          className="btn-primary w-full inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Slot
        </button>
      </div>

      {/* Added slots */}
      {slots.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {slots.length} slot{slots.length !== 1 ? 's' : ''} added
          </p>
          <div className="space-y-2">
            {slots.map((s) => {
              const vt = VEHICLE_TYPES.find((v) => v.value === s.vehicleType)!;
              return (
                <div
                  key={s.uid}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <vt.Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{s.code}</p>
                    <p className="text-xs text-slate-400">
                      {vt.label} · ₹{s.hourlyPrice}/hr
                      {s.monthlyPrice != null && s.monthlyPrice > 0 && (
                        <> · ₹{s.monthlyPrice}/mo</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveSlot(s.uid)}
                    className="shrink-0 text-slate-400 transition hover:text-red-500"
                    aria-label={`Remove slot ${s.code}`}
                  >
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
          <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">
            Add at least one slot to proceed.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (slots.length === 0) {
              setErr('Add at least one slot to continue.');
              return;
            }
            onNext();
          }}
          disabled={slots.length === 0}
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Next: Amenities <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 3: Amenity selection ─────────────────────────────────────────────────
interface Amenity {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

const AMENITY_ICON_SIZE = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' } as const;

const Step3 = ({
  selectedIds,
  onToggle,
  onBack,
  onNext,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const { data, isLoading, isError, refetch } = useQuery<{ items: Amenity[] }>({
    queryKey: ['amenities'],
    queryFn: async () => (await api.get('/vendor/amenities')).data,
    staleTime: 60_000,
    retry: 2,
  });

  const amenities = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">What amenities does your space offer?</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Select all that apply. You can change these later.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 px-6 py-10 text-center dark:border-red-800/40">
          <p className="text-sm font-medium text-red-500">Could not load amenities.</p>
          <p className="mt-1 text-xs text-slate-400">Check that the server is running, then try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-xs font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
          >
            Retry
          </button>
        </div>
      ) : amenities.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-400">No amenities have been added by the admin yet.</p>
          <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">
            You can skip this step and add amenities later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {amenities.map((a) => {
            const selected = selectedIds.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onToggle(a.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition ${
                  selected
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
              >
                {selected && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                )}
                <AmenityIcon icon={a.icon} className={AMENITY_ICON_SIZE.md} />
                <p
                  className={`mt-2 text-xs font-semibold ${
                    selected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {a.name}
                </p>
                {a.description && (
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{a.description}</p>
                )}
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
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
        >
          Preview & Submit <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ── Step 4: Preview + submit ──────────────────────────────────────────────────
const Step4 = ({
  spaceData,
  imagePreviews,
  slots,
  selectedAmenityIds,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  spaceData: SpaceFormValues;
  imagePreviews: string[];
  slots: SlotDraft[];
  selectedAmenityIds: Set<string>;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) => {
  // Fetch amenity details to show names/icons in preview
  const { data: amenityData } = useQuery<{ items: Amenity[] }>({
    queryKey: ['amenities'],
    queryFn: async () => (await api.get('/vendor/amenities')).data,
    staleTime: 60_000,
  });
  const allAmenities = amenityData?.items ?? [];
  const chosenAmenities = allAmenities.filter((a) => selectedAmenityIds.has(a.id));

  return (
  <div className="space-y-5">
    <p className="text-sm text-slate-500">
      Review your submission before sending it to admin for approval.
    </p>

    {/* Space details */}
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Space Details</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="col-span-2">
          <dt className="mb-0.5 text-xs text-slate-400">Name</dt>
          <dd className="font-semibold">{spaceData.name}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs text-slate-400">Pincode</dt>
          <dd>{spaceData.pincode}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs text-slate-400">City, State</dt>
          <dd>
            {spaceData.city}, {spaceData.state}
          </dd>
        </div>
        {spaceData.area && (
          <div>
            <dt className="mb-0.5 text-xs text-slate-400">Area</dt>
            <dd>{spaceData.area}</dd>
          </div>
        )}
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
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
          Photos ({imagePreviews.length})
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imagePreviews.map((url, i) => (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Slots */}
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
        Slots ({slots.length})
      </h3>
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
                <p className="text-xs text-slate-400">
                  {vt.label} · ₹{s.hourlyPrice}/hr
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Amenities */}
    {chosenAmenities.length > 0 && (
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
          Amenities ({chosenAmenities.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {chosenAmenities.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300"
            >
              <AmenityIcon icon={a.icon} className={AMENITY_ICON_SIZE.sm} /> {a.name}
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
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="btn-ghost inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" /> Submit for Review
          </>
        )}
      </button>
    </div>
  </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const AddParkingSpacePage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [spaceData, setSpaceData] = useState<SpaceFormValues | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke all object URLs on unmount to avoid memory leaks
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = imagePreviews;
  useEffect(
    () => () => {
      previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

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
    if (!spaceData) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the location
      const { data: loc } = await api.post('/vendor/locations', spaceData);
      const locationId: string = loc.id;

      // 2. Upload images if any were selected
      if (imageFiles.length > 0) {
        const form = new FormData();
        imageFiles.forEach((f) => form.append('files', f));
        await api.post(`/vendor/locations/${locationId}/images`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3. Create each slot
      for (const slot of slots) {
        await api.post(`/vendor/locations/${locationId}/slots`, {
          code:        slot.code,
          vehicleType: slot.vehicleType,
          hourlyPrice: slot.hourlyPrice,
          dailyPrice:  0,
          ...(slot.monthlyPrice && slot.monthlyPrice > 0
              ? { monthlyPrice: slot.monthlyPrice }
              : {}),
        });
      }

      // 4. Set amenities (if any selected)
      if (selectedAmenityIds.size > 0) {
        await api.put(`/vendor/locations/${locationId}/amenities`, {
          amenityIds: [...selectedAmenityIds],
        });
      }

      qc.invalidateQueries({ queryKey: ['vendor-spaces'] });
      navigate('/spaces', { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? 'Submission failed. Please check your details and try again.',
      );
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    else navigate('/spaces');
  };

  return (
    <section className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <button
          className="btn-ghost mt-1 inline-flex items-center gap-1 text-sm"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {step > 1 ? 'Back' : 'Cancel'}
        </button>
        <div>
          <h1 className="text-2xl font-bold">Add Parking Space</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Complete all 4 steps to submit your space for admin approval.
          </p>
        </div>
      </div>

      <StepperBar current={step} />

      <div className="card p-6">
        {step === 1 && (
          <Step1
            defaultValues={spaceData ?? undefined}
            imagePreviews={imagePreviews}
            onAddImages={addImages}
            onRemoveImage={removeImage}
            onNext={(v) => {
              setSpaceData(v);
              setStep(2);
            }}
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
