import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { api } from '@/lib/api';

export interface SpaceFormValues {
  name: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  area: string;
  latitude: number;
  longitude: number;
  description?: string;
}

const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  return null;
};

export const SpaceForm = ({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  onCancel,
}: {
  defaultValues?: Partial<SpaceFormValues>;
  onSubmit: (v: SpaceFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) => {
  const { register, handleSubmit, reset, setValue, watch } = useForm<SpaceFormValues>({
    defaultValues,
  });

  const pincode = watch('pincode');
  const lat     = watch('latitude');
  const lng     = watch('longitude');

  const [pincodeState, setPincodeState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [areas, setAreas]               = useState<string[]>([]);
  const [mapsUrl, setMapsUrl]           = useState('');
  const [mapsError, setMapsError]       = useState('');
  const pincodeRef                      = useRef('');

  useEffect(() => {
    const p = (pincode ?? '').replace(/\D/g, '');
    if (p.length !== 6 || p === pincodeRef.current) return;
    pincodeRef.current = p;
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

  const handleExtractCoords = () => {
    setMapsError('');
    const coords = parseGoogleMapsUrl(mapsUrl.trim());
    if (!coords) {
      setMapsError('Could not find coordinates. Paste the full URL from the address bar (not a short link).');
      return;
    }
    setValue('latitude',  coords.lat, { shouldDirty: true });
    setValue('longitude', coords.lng, { shouldDirty: true });
  };

  return (
    <form
      onSubmit={handleSubmit((v) => {
        onSubmit({ ...v, latitude: Number(v.latitude), longitude: Number(v.longitude) });
        if (!defaultValues) { reset(); setPincodeState('idle'); setAreas([]); setMapsUrl(''); }
      })}
      className="space-y-4"
    >
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Space / Business Name *</label>
        <input className="input w-full" placeholder="e.g. Green Park Parking" required {...register('name')} />
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

      {/* Area — populated from Post Office API */}
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
        <input className="input w-full" placeholder="Building, street…" required {...register('addressLine')} />
      </div>

      {/* Landmark */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Landmark</label>
        <input className="input w-full" placeholder="e.g. Near City Mall, opposite metro station" {...register('landmark')} />
      </div>

      {/* Google Maps → lat/lng */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Google Maps Location</label>
        <p className="mb-1.5 text-xs text-slate-400">
          Open your location on Google Maps → copy the URL from the address bar → paste below.
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
            <input className="input w-full text-sm" type="number" step="any" placeholder="e.g. 17.3850" required {...register('latitude')} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Longitude *</label>
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
        <textarea
          className="input w-full text-sm"
          rows={2}
          placeholder="Parking type, amenities, instructions for drivers… (optional)"
          {...register('description')}
        />
      </div>

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
