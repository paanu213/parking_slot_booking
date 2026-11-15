import { Bike, Car } from 'lucide-react';
import { cn } from '@/lib/cn';

export type VehicleKind = 'CAR' | 'BIKE';

const OPTIONS: { value: VehicleKind; label: string; icon: typeof Car }[] = [
  { value: 'CAR',  label: 'Car',  icon: Car },
  { value: 'BIKE', label: 'Bike', icon: Bike },
];

/** Car / Bike choice for the QR sticker — tells admin what the sticker will be stuck on. */
export const VehicleTypePicker = ({
  value,
  onChange,
  disabled,
}: {
  value: VehicleKind;
  onChange: (v: VehicleKind) => void;
  disabled?: boolean;
}) => (
  <div>
    <label className="text-sm font-medium">This sticker is for a</label>
    <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vehicle type">
      {OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:opacity-60',
              active
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        );
      })}
    </div>
  </div>
);

export const vehicleKindLabel = (v: VehicleKind | string | null | undefined) => (v === 'BIKE' ? 'Bike' : 'Car');
