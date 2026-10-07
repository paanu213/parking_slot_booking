import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Car, Droplet, HeartPulse, Loader2, LogIn, Moon, Phone,
  PhoneCall, PhoneOff, Plus, QrCode, RotateCcw, ShieldPlus, Trash2, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL, BRAND_NAME } from '@/lib/config';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/cn';
import { phoneInputProps, phoneRules, sanitizePhone } from '@/lib/phone';
import { VehicleTypePicker, vehicleKindLabel, type VehicleKind } from '@/components/VehicleTypePicker';

interface LookupResult {
  found: boolean;
  confirm?: string;
  hasEmergency?: boolean;
  permit?: string;
}

type StickerState =
  | { state: 'unclaimed' }
  | { state: 'disabled' }
  | { state: 'expired' }
  | { state: 'claimed'; plateMask: string; hasEmergency: boolean };

type CallStatus =
  | 'INITIATED' | 'RINGING_CALLER' | 'CALLER_ANSWERED' | 'RINGING_OWNER' | 'BRIDGED'
  | 'COMPLETED' | 'NO_ANSWER' | 'BUSY' | 'OWNER_REJECTED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';

interface CallStatusResult {
  id: string;
  status: CallStatus;
  initiatedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
}

const TERMINAL_CALL_STATUSES = new Set<CallStatus>([
  'COMPLETED', 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED', 'FAILED', 'BLOCKED', 'CANCELLED',
]);

const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  INITIATED:       'Connecting…',
  RINGING_CALLER:  'Calling your number…',
  CALLER_ANSWERED: 'Connecting you to the owner…',
  RINGING_OWNER:   'Ringing the owner…',
  BRIDGED:         'Connected — stay on the line',
  COMPLETED:       'Call ended',
  NO_ANSWER:       "Owner didn't answer",
  BUSY:            "Owner's line is busy",
  OWNER_REJECTED:  'Owner declined the call',
  FAILED:          'Call failed — please try again',
  BLOCKED:         'Unable to place this call',
  CANCELLED:       'Call cancelled',
};

interface EmergencyCard {
  ownerName?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  contacts: { name: string; relation?: string; phone: string }[];
}

const googleLogin = (returnPath: string) => {
  const returnTo = encodeURIComponent(returnPath);
  const origin = encodeURIComponent(window.location.origin);
  window.location.href = `${API_URL}/auth/google?portal=customer&returnTo=${returnTo}&origin=${origin}`;
};

// A matched result is stashed before a Google redirect (per-tab, one slot) so
// the scanner lands straight back on the call/emergency screen instead of
// re-entering the plate. The permit is short-lived and scoped — fine here.
const RESULT_STASH_KEY = 'qr-scan-result';
const stashResult = (r: LookupResult) => {
  try { sessionStorage.setItem(RESULT_STASH_KEY, JSON.stringify(r)); } catch { /* private mode */ }
};
const popStashedResult = (): LookupResult | null => {
  try {
    const raw = sessionStorage.getItem(RESULT_STASH_KEY);
    if (raw) { sessionStorage.removeItem(RESULT_STASH_KEY); return JSON.parse(raw) as LookupResult; }
  } catch { /* private mode */ }
  return null;
};

// Paired with the stash above — remembers that the scanner's click was
// specifically "show me the emergency card", so the moment they're back from
// Google sign-in and authenticated, the card loads on its own instead of
// making them click a second time.
const EMERGENCY_INTENT_KEY = 'qr-scan-emergency-intent';
const stashEmergencyIntent = () => {
  try { sessionStorage.setItem(EMERGENCY_INTENT_KEY, '1'); } catch { /* private mode */ }
};
const popEmergencyIntent = (): boolean => {
  try {
    if (sessionStorage.getItem(EMERGENCY_INTENT_KEY)) { sessionStorage.removeItem(EMERGENCY_INTENT_KEY); return true; }
  } catch { /* private mode */ }
  return false;
};

/**
 * Public scan page. Two entry points:
 *  - `/c`         → type the full plate (fallback for a damaged sticker)
 *  - `/c/:token`  → a unique sticker: first scan configures it (owner, Google
 *    sign-in), later scans just ask for the last 4 of the plate.
 * A match unlocks a masked call; the emergency card additionally needs the
 * scanner signed in.
 */
export const ScanPage = () => {
  const { token } = useParams<{ token?: string }>();

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Car className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Reach this car's owner
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {token ? <StickerFlow token={token} /> : <PlateEntryFlow />}
        </div>

        <Link to="/" className="mt-6 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> {BRAND_NAME}
        </Link>
      </div>
    </main>
  );
};

// ── /c/:token ────────────────────────────────────────────────────────────────

const StickerFlow = ({ token }: { token: string }) => {
  const { data, isLoading, isError, error } = useQuery<StickerState>({
    queryKey: ['sticker', token],
    queryFn: async () => (await api.get<StickerState>(`/c/t/${token}`)).data,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (isError) {
    const notFound = (error as any)?.status === 404;
    return (
      <ErrorCard
        title={notFound ? 'QR code not recognised' : 'Something went wrong'}
        body={notFound
          ? 'This sticker isn’t in our system. If you scanned it off a car, the plate can still be entered manually below.'
          : 'Please try again in a moment.'}
        showManual={notFound}
      />
    );
  }

  if (data?.state === 'disabled') {
    return (
      <ErrorCard
        title="This sticker is inactive"
        body="It’s been disabled. Please contact support if you think this is a mistake."
      />
    );
  }

  if (data?.state === 'expired') {
    return (
      <ErrorCard
        title="This QR code's validity has ended"
        body="Its validity period is over. The car owner should contact support to renew it."
      />
    );
  }

  if (data?.state === 'unclaimed') return <ConfigureSticker token={token} />;

  return <VerifyLast4 token={token} plateMask={data!.plateMask} hasEmergency={data!.hasEmergency} />;
};

const ErrorCard = ({ title, body, showManual }: { title: string; body: string; showManual?: boolean }) => (
  <div className="space-y-4 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
      <QrCode className="h-6 w-6" />
    </span>
    <div>
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
    {showManual && (
      <Link to="/c" className="btn-primary w-full justify-center gap-1.5">
        Enter plate manually
      </Link>
    )}
  </div>
);

// ── First scan: owner configures the sticker ─────────────────────────────────

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MAX_CONTACTS = 5;

interface ContactForm { name: string; relation: string; phone: string; showPublic: boolean }
interface ConfigForm {
  vehicleType: VehicleKind;
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  silentFrom: string;
  silentTo: string;
  emergencyPublic: boolean;
  bloodGroup: string;
  medicalNotes: string;
  emergencyContacts: ContactForm[];
}
const EMPTY_CONFIG: ConfigForm = {
  vehicleType: 'CAR', plateNumber: '', contactPhone: '', ownerName: '', silentFrom: '', silentTo: '',
  emergencyPublic: false, bloodGroup: '', medicalNotes: '', emergencyContacts: [],
};

const ConfigureSticker = ({ token }: { token: string }) => {
  const { user } = useAuth();
  const loc = useLocation();
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [prefilled, setPrefilled] = useState(false);

  const {
    register, control, handleSubmit, watch, setValue, getValues,
    formState: { errors },
  } = useForm<ConfigForm>({ defaultValues: EMPTY_CONFIG });

  const { fields, append, remove } = useFieldArray({ control, name: 'emergencyContacts' });
  const emergencyPublic = watch('emergencyPublic');
  const plateNumber = watch('plateNumber');
  const vehicleType = watch('vehicleType');
  const lastLookedUp = useRef('');

  // Once the plate looks complete, check whether this owner already has a
  // saved registration for it (added earlier via My Vehicles, or another
  // sticker) — if so, pre-fill the rest of the form instead of asking them
  // to type it all again. A 404 just means it's a fresh plate; nothing to do.
  useEffect(() => {
    if (!user) return;
    const p = plateNumber.trim();
    if (!/^[A-Z0-9]{6,12}$/.test(p) || p === lastLookedUp.current) return;
    lastLookedUp.current = p;
    api.get(`/customer/me/vehicles/by-plate/${p}`)
      .then(({ data }) => {
        const v = data.vehicle;
        setValue('vehicleType', v.vehicleType === 'BIKE' ? 'BIKE' : 'CAR', { shouldDirty: true });
        setValue('contactPhone', sanitizePhone(v.contactPhone), { shouldDirty: true });
        setValue('ownerName', v.ownerName ?? '', { shouldDirty: true });
        setValue('silentFrom', v.silentFrom ?? '', { shouldDirty: true });
        setValue('silentTo', v.silentTo ?? '', { shouldDirty: true });
        setValue('emergencyPublic', v.emergencyPublic, { shouldDirty: true });
        setValue('bloodGroup', v.bloodGroup ?? '', { shouldDirty: true });
        setValue('medicalNotes', v.medicalNotes ?? '', { shouldDirty: true });
        setValue(
          'emergencyContacts',
          v.emergencyContacts.map((c: { name: string; relation: string | null; phone: string; showPublic: boolean }) => ({
            name: c.name, relation: c.relation ?? '', phone: sanitizePhone(c.phone), showPublic: c.showPublic,
          })),
          { shouldDirty: true },
        );
        setPrefilled(true);
      })
      .catch(() => { /* no existing registration for this plate — fresh entry */ });
  }, [user, plateNumber, setValue]);

  const configure = useMutation({
    mutationFn: async (v: ConfigForm) => {
      const res = await api.post(`/c/t/${token}/configure`, {
        vehicleType:  v.vehicleType,
        plateNumber:  v.plateNumber.trim(),
        contactPhone: v.contactPhone.trim(),
        ownerName:    v.ownerName.trim() || undefined,
        silentFrom:   v.silentFrom || undefined,
        silentTo:     v.silentTo || undefined,
        emergencyPublic: v.emergencyPublic,
        bloodGroup:      v.emergencyPublic ? (v.bloodGroup || undefined) : undefined,
        medicalNotes:    v.emergencyPublic ? (v.medicalNotes.trim() || undefined) : undefined,
        emergencyContacts: v.emergencyPublic
          ? v.emergencyContacts.map((c) => ({
              name: c.name.trim(), relation: c.relation.trim() || undefined, phone: c.phone.trim(), showPublic: c.showPublic,
            }))
          : [],
      });
      return res.data;
    },
    onSuccess: () => setStep('done'),
  });

  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <QrCode className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Set up this QR sticker</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in with Google to link this sticker to your vehicle. It takes a minute.
          </p>
        </div>
        <button
          type="button"
          onClick={() => googleLogin(loc.pathname)}
          className="btn-primary w-full justify-center gap-2"
        >
          <LogIn className="h-4 w-4" /> Continue with Google
        </button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <QrCode className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Sticker activated</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Anyone who scans it can now reach you with a masked call. Manage it — silent hours, an
            emergency card, blocking a caller — from My Vehicles.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/vehicles" className="btn-primary gap-1.5"><Car className="h-4 w-4" /> My Vehicles</Link>
          <Link to="/" className="btn-ghost">Done</Link>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    const v = getValues();
    const err = (configure.error as any)?.message ?? 'Could not activate the sticker. Please try again.';
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Please confirm</p>
        <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/40">
          <Confirm label="Vehicle" value={vehicleKindLabel(v.vehicleType)} />
          <Confirm label="Number plate" value={v.plateNumber} />
          <Confirm label="Contact number" value={v.contactPhone} />
          {v.ownerName.trim() && <Confirm label="Owner name" value={v.ownerName} />}
          {(v.silentFrom || v.silentTo) && (
            <Confirm label="Silent hours" value={`${v.silentFrom || '—'} → ${v.silentTo || '—'}`} />
          )}
          <Confirm label="Emergency card" value={v.emergencyPublic ? 'On' : 'Off'} />
          {v.emergencyPublic && v.bloodGroup && <Confirm label="Blood group" value={v.bloodGroup} />}
          {v.emergencyPublic && v.emergencyContacts.length > 0 && (
            <Confirm label="Emergency contacts" value={String(v.emergencyContacts.length)} />
          )}
        </dl>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Signed in as {user.fullName} · {user.email}
        </p>
        {configure.isError && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep('form')} className="btn-ghost flex-1 justify-center">Edit</button>
          <button
            type="button"
            onClick={() => configure.mutate(v)}
            disabled={configure.isPending}
            className="btn-primary flex-1 justify-center"
          >
            {configure.isPending ? 'Activating…' : 'Confirm & activate'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(() => setStep('confirm'))} className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Link this sticker to your car. Enter the details a caller reaches you on.
      </p>

      {prefilled && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          We found saved details for this plate — review and edit anything below, then continue.
        </p>
      )}

      <VehicleTypePicker value={vehicleType} onChange={(v) => setValue('vehicleType', v, { shouldDirty: true })} />
      <div>
        <label className="text-sm font-medium">Number plate</label>
        <input
          autoFocus
          className={cn(
            'input mt-1 w-full text-center font-mono text-lg uppercase tracking-widest',
            errors.plateNumber && 'border-rose-500',
          )}
          placeholder="AP16HJ7956"
          {...register('plateNumber', {
            required: 'Enter your car number',
            pattern: { value: /^[A-Z0-9]{6,12}$/, message: 'Enter a valid car number' },
            onChange: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); },
          })}
        />
        {errors.plateNumber && <p className="mt-1 text-xs text-rose-600">{errors.plateNumber.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Contact number</label>
        <input
          {...phoneInputProps}
          className={cn('input mt-1 w-full', errors.contactPhone && 'border-rose-500')}
          placeholder="10-digit number that rings when someone scans your QR"
          {...register('contactPhone', phoneRules('Enter the number to ring'))}
        />
        {errors.contactPhone && <p className="mt-1 text-xs text-rose-600">{errors.contactPhone.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Your name <span className="text-xs text-slate-400">(optional)</span></label>
        <input className="input mt-1 w-full" {...register('ownerName')} />
      </div>

      {/* Silent hours */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Moon className="h-3.5 w-3.5 text-slate-400" /> Silent hours <span className="text-xs font-normal text-slate-400">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input type="time" className="input w-full" {...register('silentFrom')} />
          <span className="text-slate-400">→</span>
          <input type="time" className="input w-full" {...register('silentTo')} />
        </div>
        <p className="text-xs text-slate-400">No calls will ring through during this window.</p>
      </div>

      {/* Emergency (ICE) card */}
      <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldPlus className="h-3.5 w-3.5 text-rose-500" /> Emergency card
          </span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" {...register('emergencyPublic')} />
            <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 dark:bg-slate-700" />
            <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-4" />
          </label>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Off by default. When on, a scanner who verifies your plate sees this — blood group,
          notes, and family contacts. Every field here is optional.
        </p>

        {emergencyPublic && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            <div>
              <label className="text-sm font-medium">Blood group</label>
              <select className="input mt-1 w-full" {...register('bloodGroup')}>
                <option value="">Not specified</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Medical notes</label>
              <textarea
                rows={2}
                maxLength={500}
                className="input mt-1 w-full resize-none"
                placeholder="Allergies, conditions, etc."
                {...register('medicalNotes')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Emergency contacts</label>
                <button
                  type="button"
                  disabled={fields.length >= MAX_CONTACTS}
                  onClick={() => append({ name: '', relation: '', phone: '', showPublic: true })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add contact
                </button>
              </div>
              {fields.length === 0 && <p className="text-xs text-slate-400">No family contacts added yet.</p>}
              {fields.map((field, i) => (
                <div key={field.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1" placeholder="Name" {...register(`emergencyContacts.${i}.name` as const, { required: true })} />
                    <input className="input w-24" placeholder="Relation" {...register(`emergencyContacts.${i}.relation` as const)} />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label="Remove contact"
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      {...phoneInputProps}
                      className="input flex-1"
                      placeholder="10-digit mobile"
                      {...register(`emergencyContacts.${i}.phone` as const, phoneRules('Required'))}
                    />
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <input type="checkbox" className="h-3.5 w-3.5 rounded" {...register(`emergencyContacts.${i}.showPublic` as const)} />
                      Show on card
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button type="submit" className="btn-primary w-full justify-center">
        Review
      </button>
    </form>
  );
};

const Confirm = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="font-medium text-slate-800 dark:text-slate-100">{value}</dd>
  </div>
);

// ── Later scans: passer-by enters the last 4 ─────────────────────────────────

const VerifyLast4 = ({ token, plateMask, hasEmergency }: { token: string; plateMask: string; hasEmergency: boolean }) => {
  const [last4, setLast4] = useState('');
  // Restore a match stashed before a Google sign-in redirect.
  const [result, setResult] = useState<LookupResult | null>(() => popStashedResult());

  const verify = useMutation({
    mutationFn: async () => (await api.post<LookupResult>(`/c/t/${token}/verify`, { last4 })).data,
    onSuccess: (data) => { if (data.found) setResult(data); },
  });

  if (result?.found) return <FoundResult result={result} />;

  const errMsg =
    (verify.error as any)?.status === 429
      ? "You've tried too many times. Please wait a bit and try again."
      : (verify.error as any)?.message ?? 'Something went wrong. Please try again.';
  const mismatched = verify.isSuccess && !verify.data?.found;

  return (
    <form onSubmit={(e) => { e.preventDefault(); verify.mutate(); }} className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        To reach the owner, enter the <strong>last 4 digits</strong> of this car's number plate.
      </p>
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-800 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">
          {plateMask}
          <span className="text-slate-400">····</span>
        </span>
      </div>
      {hasEmergency && (
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">
          <ShieldPlus className="h-3.5 w-3.5" /> This car has an emergency (ICE) card
        </p>
      )}
      <input
        autoFocus
        value={last4}
        onChange={(e) => setLast4(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
        placeholder="last 4"
        inputMode="numeric"
        className="input w-full text-center font-mono text-xl uppercase tracking-[0.5em]"
      />
      {(verify.isError || mismatched) && (
        <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {mismatched ? "That doesn't match this car. Check the plate and try again." : errMsg}
        </p>
      )}
      <button type="submit" disabled={last4.length < 4 || verify.isPending} className="btn-primary w-full justify-center">
        {verify.isPending ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
};

// ── Shared: after a match — call + emergency ─────────────────────────────────

const FoundResult = ({ result, onReset }: { result: LookupResult; onReset?: () => void }) => {
  const { user } = useAuth();
  const loc = useLocation();
  const [card, setCard] = useState<EmergencyCard | null>(null);

  const revealEmergency = useMutation({
    mutationFn: async () =>
      (await api.post<EmergencyCard>('/c/emergency', { permit: result.permit })).data,
    onSuccess: (data) => setCard(data),
  });

  // Resume automatically after a Google sign-in redirect if the scanner had
  // clicked "view emergency card" before signing in — no second click needed.
  useEffect(() => {
    if (user && result.hasEmergency && !card && popEmergencyIntent()) {
      revealEmergency.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="inline-block rounded-lg border-2 border-slate-800 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">
          {result.confirm}
        </span>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Car found — choose an option below</p>
      </div>

      <div className="space-y-2">
        <CallPanel permit={result.permit!} />

        {result.hasEmergency && !card && (
          !user ? (
            <button
              type="button"
              onClick={() => { stashResult(result); stashEmergencyIntent(); googleLogin(loc.pathname + loc.search); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-500 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <LogIn className="h-4 w-4" /> Sign in to view emergency info
            </button>
          ) : (
            <button
              type="button"
              onClick={() => revealEmergency.mutate()}
              disabled={revealEmergency.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-500 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <ShieldPlus className="h-4 w-4" />
              {revealEmergency.isPending ? 'Loading…' : 'View emergency card'}
            </button>
          )
        )}
        {revealEmergency.isError && (
          <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {(revealEmergency.error as any)?.message ?? 'Could not load the emergency card. The link may have expired — scan again.'}
          </p>
        )}
      </div>

      {card && <EmergencyCardView card={card} />}

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400"
        >
          <RotateCcw className="h-3 w-3" /> Search another car
        </button>
      )}
    </div>
  );
};

// ── /c — type the full plate (fallback) ──────────────────────────────────────

const PlateEntryFlow = () => {
  const [plate, setPlate] = useState('');
  const [honeypot, setHoneypot] = useState('');
  // Restore a match stashed before a Google sign-in redirect.
  const [result, setResult] = useState<LookupResult | null>(() => popStashedResult());

  const lookup = useMutation({
    mutationFn: async () => {
      const res = await api.post<LookupResult>('/c/lookup', { plate, botToken: honeypot || undefined });
      return res.data;
    },
    onSuccess: (data) => setResult(data),
  });

  const reset = () => { setPlate(''); setResult(null); lookup.reset(); };

  const lookupErrorMessage =
    (lookup.error as any)?.status === 429
      ? "You've tried too many times. Please wait a bit and try again."
      : (lookup.error as any)?.message ?? 'Something went wrong. Please try again.';

  if (result?.found) return <FoundResult result={result} onReset={reset} />;

  if (result && !result.found) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Car className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">No car found</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This plate isn't registered with {BRAND_NAME} yet.</p>
        </div>
        <button type="button" onClick={reset} className="btn-primary w-full justify-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); lookup.mutate(); }} className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">Enter the full number plate to continue.</p>
      <div>
        <label className="text-sm font-medium">Number plate</label>
        <input
          autoFocus
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
          placeholder="AP16HJ7956"
          className="input mt-1 w-full text-center font-mono text-lg uppercase tracking-widest"
          autoComplete="off"
        />
      </div>

      {/* Honeypot — visually hidden */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {lookup.isError && (
        <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {lookupErrorMessage}
        </p>
      )}

      <button type="submit" disabled={plate.length < 6 || lookup.isPending} className="btn-primary w-full justify-center">
        {lookup.isPending ? 'Searching…' : 'Find this car'}
      </button>
    </form>
  );
};

/**
 * Call owner — button → phone-entry → live status, polling GET
 * /c/call/:id/status until the call reaches a terminal state. The
 * `idempotencyKey` is generated once per mount so a double-tap or a
 * retried request never places a second call.
 */
const CallPanel = ({ permit }: { permit: string }) => {
  const [step, setStep] = useState<'idle' | 'enter-number'>('idle');
  const [callerNumber, setCallerNumber] = useState('');
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const initiate = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ callSessionId: string }>('/c/call', { permit, callerNumber, idempotencyKey });
      return res.data;
    },
    onSuccess: (data) => setCallSessionId(data.callSessionId),
  });

  const statusQuery = useQuery<CallStatusResult>({
    queryKey: ['call-status', callSessionId],
    queryFn: async () => (await api.get<CallStatusResult>(`/c/call/${callSessionId}/status`)).data,
    enabled: !!callSessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_CALL_STATUSES.has(status) ? false : 1500;
    },
  });

  const initiateErrorMessage = (initiate.error as any)?.message ?? 'Could not place the call. Please try again.';

  if (callSessionId) {
    const status = statusQuery.data?.status;
    const isTerminal = status ? TERMINAL_CALL_STATUSES.has(status) : false;
    const isConnected = status === 'BRIDGED';
    const failed = isTerminal && status !== 'COMPLETED';

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border-2 p-3.5',
          isConnected
            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-500/10'
            : failed
              ? 'border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10'
              : 'border-brand-200 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10',
        )}
      >
        {!isTerminal ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-600" />
        ) : status === 'COMPLETED' ? (
          <PhoneCall className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <PhoneOff className="h-5 w-5 shrink-0 text-rose-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {status ? CALL_STATUS_LABEL[status] : 'Connecting…'}
          </p>
          {statusQuery.data?.durationSec != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{statusQuery.data.durationSec}s</p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'enter-number') {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); initiate.mutate(); }}
        className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
      >
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Your mobile number — we'll call you first, then connect you to the owner
        </label>
        <input
          autoFocus
          {...phoneInputProps}
          value={callerNumber}
          onChange={(e) => setCallerNumber(sanitizePhone(e.target.value))}
          placeholder="10-digit mobile"
          className="input w-full"
        />
        {initiate.isError && (
          <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {initiateErrorMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={callerNumber.length !== 10 || initiate.isPending}
          className="btn-primary w-full justify-center gap-2"
        >
          <PhoneCall className="h-4 w-4" /> {initiate.isPending ? 'Connecting…' : 'Call now'}
        </button>
      </form>
    );
  }

  return (
    <button type="button" onClick={() => setStep('enter-number')} className="btn-primary w-full justify-center gap-2">
      <Phone className="h-4 w-4" /> Call owner
    </button>
  );
};

const EmergencyCardView = ({ card }: { card: EmergencyCard }) => (
  <div className="overflow-hidden rounded-xl border border-rose-200 dark:border-rose-900/40">
    <div className="flex items-center gap-1.5 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
      <HeartPulse className="h-4 w-4" /> Emergency information
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {card.ownerName && <Row label="Owner" value={card.ownerName} />}
      {card.bloodGroup && (
        <Row label="Blood group" value={card.bloodGroup} icon={<Droplet className="h-3.5 w-3.5 text-rose-500" />} />
      )}
      {card.medicalNotes && <Row label="Medical note" value={card.medicalNotes} />}
      {card.contacts.map((c, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {c.name}
            {c.relation ? ` (${c.relation})` : ''}
            {/* Visible + selectable, not just a tel: link — on desktop (no
                registered phone handler) tapping "Call" alone does nothing,
                so the number itself must be readable/copyable here too. */}
            <span className="block font-mono text-xs text-slate-400">{c.phone}</span>
          </span>
          <a
            href={`tel:${c.phone}`}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Call
          </a>
        </div>
      ))}
      {card.contacts.length === 0 && !card.ownerName && !card.bloodGroup && !card.medicalNotes && (
        <p className="flex items-center gap-1.5 px-3 py-3 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" /> No emergency details shared.
        </p>
      )}
    </div>
  </div>
);

const Row = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
      {icon} {label}
    </span>
    <span className="font-medium text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);
