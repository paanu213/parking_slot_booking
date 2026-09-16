import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Car, CalendarClock, ChevronDown, History, Infinity as InfinityIcon, Link2, Moon, Pause, Pencil, Phone,
  Play, QrCode, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import { Footer } from '@/components/Footer';
import { VehicleFormDrawer } from '@/components/VehicleFormDrawer';
import { cn } from '@/lib/cn';

export interface VehicleContact {
  id: string;
  name: string;
  relation: string | null;
  phone: string;
  showPublic: boolean;
}

export interface CallLogItem {
  id: string;
  status: string;
  initiatedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  callerMasked: string;
}

const CALL_LOG_STATUS_LABEL: Record<string, string> = {
  INITIATED:       'Connecting',
  RINGING_CALLER:  'Ringing caller',
  CALLER_ANSWERED: 'Caller answered',
  RINGING_OWNER:   'Ringing you',
  BRIDGED:         'In progress',
  COMPLETED:       'Completed',
  NO_ANSWER:       'No answer',
  BUSY:            'Busy',
  OWNER_REJECTED:  'Declined',
  FAILED:          'Failed',
  BLOCKED:         'Blocked',
  CANCELLED:       'Cancelled',
};

export interface Vehicle {
  id: string;
  plateNumber: string;
  contactPhone: string;
  contactVerified: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'DELETED';
  silentFrom: string | null;
  silentTo: string | null;
  emergencyPublic: boolean;
  ownerName: string | null;
  bloodGroup: string | null;
  medicalNotes: string | null;
  validUntil: string | null;
  qrLinked: boolean;
  qrLinkedAt: string | null;
  emergencyContacts: VehicleContact[];
  createdAt: string;
  updatedAt: string;
}

/**
 * "My Vehicles" — manage scan-to-call settings + the opt-in emergency (ICE)
 * card for cars you've already ordered a QR sticker for. A vehicle only
 * exists here once it comes through the paid "Get QR sticker" checkout
 * (see QrCallingLandingPage) — a car with no sticker can never receive
 * calls, so there's deliberately no standalone "add vehicle" entry point.
 */
export const MyVehiclesPage = () => {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<'closed' | Vehicle>('closed');

  const { data, isLoading } = useQuery<{ items: Vehicle[] }>({
    queryKey: ['my-vehicles'],
    queryFn: async () => (await api.get('/customer/me/vehicles')).data,
  });
  const items = data?.items ?? [];

  const toggleStatus = useMutation({
    mutationFn: (v: Vehicle) =>
      api.patch(`/customer/me/vehicles/${v.id}/${v.status === 'ACTIVE' ? 'pause' : 'resume'}`),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['my-vehicles'] });
      toast.success(v.status === 'ACTIVE' ? 'Calls paused' : 'Vehicle resumed');
    },
    onError: (e: any) => toast.error('Could not update', e?.response?.data?.error?.message ?? 'Please try again.'),
  });

  const deleteVehicle = useMutation({
    mutationFn: (id: string) => api.delete(`/customer/me/vehicles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-vehicles'] });
      toast.success('Vehicle removed');
    },
    onError: (e: any) => toast.error('Could not remove', e?.response?.data?.error?.message ?? 'Please try again.'),
  });

  const onDelete = (v: Vehicle) => {
    if (window.confirm(`Remove ${v.plateNumber} from scan-to-call? Its QR sticker will stop working.`)) {
      deleteVehicle.mutate(v.id);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Car className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">My vehicles</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Scan-to-call + emergency card, per car</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-4">
              {items.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onEdit={() => setDrawer(v)}
                  onToggleStatus={() => toggleStatus.mutate(v)}
                  onDelete={() => onDelete(v)}
                  busy={toggleStatus.isPending || deleteVehicle.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Car className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold">No vehicles yet</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vehicles show up here once you order a QR sticker for them — the sticker is what
                lets people scan and call you.
              </p>
              <Link to="/qr-calling" className="btn-primary mt-5 inline-flex gap-1.5">
                <Car className="h-4 w-4" /> Get a QR sticker
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {drawer !== 'closed' && (
        <VehicleFormDrawer vehicle={drawer} onClose={() => setDrawer('closed')} />
      )}
    </>
  );
};

const VehicleCard = ({
  vehicle: v,
  onEdit,
  onToggleStatus,
  onDelete,
  busy,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  busy: boolean;
}) => {
  const isActive = v.status === 'ACTIVE';
  const visibleContacts = v.emergencyContacts.filter((c) => c.showPublic).length;
  const [showCalls, setShowCalls] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border-2 border-slate-800 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">
            {v.plateNumber}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-amber-500')} />
            {isActive ? 'Active' : 'Paused'}
          </span>
          {v.qrLinked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              <Link2 className="h-3 w-3" /> QR linked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <QrCode className="h-3 w-3" /> No QR scanned yet
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
          <IconButton label={isActive ? 'Pause' : 'Resume'} onClick={onToggleStatus} disabled={busy}>
            {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Remove" onClick={onDelete} disabled={busy} danger>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-slate-400" /> {v.contactPhone}
        </span>
        {(v.silentFrom || v.silentTo) && (
          <span className="inline-flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5 text-slate-400" />
            Silent {v.silentFrom ?? '—'} → {v.silentTo ?? '—'}
          </span>
        )}
      </div>

      <div className="mt-2">
        <QrValidityBadge validUntil={v.validUntil} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {v.emergencyPublic ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Emergency card on
            {visibleContacts > 0 && (
              <span className="inline-flex items-center gap-0.5 text-rose-500/80 dark:text-rose-300/80">
                <Users className="h-3 w-3" /> {visibleContacts}
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Emergency card is off</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCalls((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400"
      >
        <History className="h-3.5 w-3.5" /> Call history
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showCalls && 'rotate-180')} />
      </button>
      {showCalls && <CallHistory vehicleId={v.id} />}
    </div>
  );
};

const CallHistory = ({ vehicleId }: { vehicleId: string }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ items: CallLogItem[] }>({
    queryKey: ['vehicle-calls', vehicleId],
    queryFn: async () => (await api.get(`/customer/me/vehicles/${vehicleId}/calls`)).data,
  });
  const items = data?.items ?? [];

  const block = useMutation({
    mutationFn: (callId: string) => api.post(`/customer/me/vehicles/${vehicleId}/calls/${callId}/block`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-calls', vehicleId] });
      toast.success('Number blocked', "They won't be able to call this car again.");
    },
    onError: (e: any) => toast.error('Could not block', e?.response?.data?.error?.message ?? 'Please try again.'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    );
  }
  if (items.length === 0) return <p className="pt-2 text-xs text-slate-400">No calls yet.</p>;

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-slate-700 dark:text-slate-200">{c.callerMasked}</p>
            <p className="text-xs text-slate-400">
              {new Date(c.initiatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}{CALL_LOG_STATUS_LABEL[c.status] ?? c.status}
              {c.durationSec != null ? ` · ${c.durationSec}s` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => block.mutate(c.id)}
            disabled={block.isPending}
            className="shrink-0 text-xs font-semibold text-rose-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Block
          </button>
        </div>
      ))}
    </div>
  );
};

/** The one-time sticker fee is lifetime by default; admin can set a per-vehicle end date. */
const QrValidityBadge = ({ validUntil }: { validUntil: string | null }) => {
  if (!validUntil) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <InfinityIcon className="h-3.5 w-3.5" /> QR validity: Lifetime
      </span>
    );
  }
  const expired = new Date(validUntil).getTime() < Date.now();
  const dateStr = new Date(validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        expired
          ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
      )}
    >
      <CalendarClock className="h-3.5 w-3.5" /> {expired ? `QR validity expired ${dateStr}` : `QR valid until ${dateStr}`}
    </span>
  );
};

const IconButton = ({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn(
      'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800',
      danger && 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10',
    )}
  >
    {children}
  </button>
);
