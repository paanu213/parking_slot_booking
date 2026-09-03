import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Car, Droplet, HeartPulse, Loader2, Phone,
  PhoneCall, PhoneOff, RotateCcw, ShieldPlus, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BRAND_NAME } from '@/lib/config';
import { cn } from '@/lib/cn';

interface LookupResult {
  found: boolean;
  confirm?: string;
  hasEmergency?: boolean;
  permit?: string;
}

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

/**
 * Public scan page — `/c`. The one URL printed on every QR sticker. A
 * passer-by types the full plate; a match unlocks "Call owner" (disabled —
 * telephony lands in a later phase) and, if the owner opted in, the
 * emergency (ICE) card. No sign-in, no PII ever shown before a plate match.
 */
export const ScanPage = () => {
  const [plate, setPlate] = useState('');
  const [honeypot, setHoneypot] = useState(''); // hidden field — real users never fill this in
  const [result, setResult] = useState<LookupResult | null>(null);
  const [card, setCard] = useState<EmergencyCard | null>(null);

  const lookup = useMutation({
    mutationFn: async () => {
      const res = await api.post<LookupResult>('/c/lookup', {
        plate,
        botToken: honeypot || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => setResult(data),
  });

  const revealEmergency = useMutation({
    mutationFn: async () => {
      const res = await api.get<EmergencyCard>('/c/emergency', { params: { permit: result?.permit } });
      return res.data;
    },
    onSuccess: (data) => setCard(data),
  });

  const reset = () => {
    setPlate('');
    setResult(null);
    setCard(null);
    lookup.reset();
    revealEmergency.reset();
  };

  const lookupErrorMessage =
    (lookup.error as any)?.status === 429
      ? "You've tried too many times. Please wait a bit and try again."
      : (lookup.error as any)?.message ?? 'Something went wrong. Please try again.';

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
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter the full number plate to continue
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {!result ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookup.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Number plate</label>
                <input
                  autoFocus
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                  placeholder="AP16HJ7956"
                  className="input mt-1 w-full text-center font-mono text-lg uppercase tracking-widest"
                  inputMode="text"
                  autoComplete="off"
                />
              </div>

              {/* Honeypot — visually hidden, real users never see or fill it */}
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

              <button
                type="submit"
                disabled={plate.length < 6 || lookup.isPending}
                className="btn-primary w-full justify-center"
              >
                {lookup.isPending ? 'Searching…' : 'Find this car'}
              </button>
            </form>
          ) : result.found ? (
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
                  <button
                    type="button"
                    onClick={() => revealEmergency.mutate()}
                    disabled={revealEmergency.isPending}
                    className="w-full justify-center gap-2 rounded-xl border-2 border-rose-500 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-500/10 inline-flex items-center"
                  >
                    <ShieldPlus className="h-4 w-4" />
                    {revealEmergency.isPending ? 'Loading…' : 'View emergency card'}
                  </button>
                )}
              </div>

              {card && <EmergencyCardView card={card} />}

              <button
                type="button"
                onClick={reset}
                className="inline-flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400"
              >
                <RotateCcw className="h-3 w-3" /> Search another car
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Car className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">No car found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  This plate isn't registered with {BRAND_NAME} yet.
                </p>
              </div>
              <button type="button" onClick={reset} className="btn-primary w-full justify-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600"
        >
          <ArrowLeft className="h-3 w-3" /> {BRAND_NAME}
        </Link>
      </div>
    </main>
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
          type="tel"
          value={callerNumber}
          onChange={(e) => setCallerNumber(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
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
          disabled={callerNumber.length < 8 || initiate.isPending}
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
          </span>
          <a
            href={`tel:${c.phone}`}
            className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
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
