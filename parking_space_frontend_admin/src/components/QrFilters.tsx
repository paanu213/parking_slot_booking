import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bike, Car, HeartPulse, MapPin, Search, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { SearchableSelect } from '@/components/SearchableSelect';

export interface QrFilters { q: string; vehicleType: string | null; state: string | null; city: string | null }
export const EMPTY_QR_FILTERS: QrFilters = { q: '', vehicleType: null, state: null, city: null };

const TYPE_LABEL: Record<string, string> = { Car: 'CAR', Bike: 'BIKE' };
const TYPE_OPTIONS = Object.keys(TYPE_LABEL);

export const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

/** Query params for the admin list endpoints. `searchKey` differs per endpoint (`q` vs `search`). */
export const qrFilterParams = (f: QrFilters, searchKey: 'q' | 'search') => ({
  [searchKey]: f.q.trim() || undefined,
  vehicleType: f.vehicleType ?? undefined,
  state: f.state ?? undefined,
  city: f.city ?? undefined,
});

/** Search box + Car/Bike + State + City dropdowns (all type-to-search). */
export const QrFilterBar = ({
  value, onChange, placeholder = 'Search name, phone, email, car number, city…',
}: { value: QrFilters; onChange: (f: QrFilters) => void; placeholder?: string }) => {
  const { data } = useQuery<{ locations: { state: string; city: string }[] }>({
    queryKey: ['admin-qr-filter-options'],
    queryFn: async () => (await api.get('/admin/qr/filter-options')).data,
    staleTime: 60_000,
  });
  const locations = data?.locations ?? [];

  const states = useMemo(() => [...new Set(locations.map((l) => l.state))].sort(), [locations]);
  const cities = useMemo(
    () => [...new Set(locations.filter((l) => !value.state || l.state === value.state).map((l) => l.city))].sort(),
    [locations, value.state],
  );

  const active = !!(value.q || value.vehicleType || value.state || value.city);
  const typeLabel = value.vehicleType === 'BIKE' ? 'Bike' : value.vehicleType === 'CAR' ? 'Car' : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={placeholder}
          className="input h-9 w-72 pl-9"
        />
      </div>
      <SearchableSelect
        value={typeLabel}
        onChange={(v) => onChange({ ...value, vehicleType: v ? TYPE_LABEL[v] : null })}
        options={TYPE_OPTIONS}
        placeholder="Car / Bike"
        icon={<Car className="h-3.5 w-3.5" />}
        width="w-36"
      />
      <SearchableSelect
        value={value.state}
        // A city belongs to one state — drop it if the state changes.
        onChange={(v) => onChange({ ...value, state: v, city: v && value.city && !locations.some((l) => l.state === v && l.city === value.city) ? null : value.city })}
        options={states}
        placeholder="All states"
        icon={<MapPin className="h-3.5 w-3.5" />}
        width="w-48"
      />
      <SearchableSelect
        value={value.city}
        onChange={(v) => onChange({ ...value, city: v })}
        options={cities}
        placeholder="All cities"
        icon={<MapPin className="h-3.5 w-3.5" />}
        width="w-48"
      />
      {active && (
        <button type="button" onClick={() => onChange(EMPTY_QR_FILTERS)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
};

export const VehicleTypeBadge = ({ type }: { type: string | null | undefined }) => {
  const bike = type === 'BIKE';
  const Icon = bike ? Bike : Car;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
      bike ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    )}>
      <Icon className="h-3 w-3" /> {bike ? 'Bike' : 'Car'}
    </span>
  );
};

export interface EmergencyInfo {
  public: boolean;
  bloodGroup: string | null;
  medicalNotes: string | null;
  contacts: { id: string; name: string; relation: string | null; phone: string; showPublic: boolean }[];
}

/** Emergency (ICE) details — shown to admin whether or not the customer made the public card visible. */
export const EmergencyBlock = ({ info }: { info: EmergencyInfo | null | undefined }) => {
  if (!info || (!info.bloodGroup && !info.medicalNotes && info.contacts.length === 0)) {
    return <p className="text-xs text-slate-400">No emergency details added.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <HeartPulse className="h-3.5 w-3.5" /> Emergency details
        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] normal-case', info.public ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
          {info.public ? 'Card public' : 'Card off'}
        </span>
      </p>
      {info.bloodGroup && <p>Blood group: <span className="font-medium">{info.bloodGroup}</span></p>}
      {info.medicalNotes && <p>Medical notes: <span className="font-medium">{info.medicalNotes}</span></p>}
      {info.contacts.map((c) => (
        <p key={c.id} className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {c.name}{c.relation ? ` (${c.relation})` : ''}, {' '}
          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="text-brand-600 hover:underline">{c.phone}</a>
          {!c.showPublic && <span className="text-xs text-slate-400">(hidden on card)</span>}
        </p>
      ))}
    </div>
  );
};
