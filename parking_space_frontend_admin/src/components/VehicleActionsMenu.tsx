import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, Infinity as InfinityIcon, Pause, Phone, Play, UserCog, X } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/qrCallingFormat';
import { KebabMenu, MenuItem, MenuDivider } from '@/components/KebabMenu';

export interface VehicleActionTarget {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'DELETED';
  contactPhone: string;
  validUntil: string | null;
}

/**
 * Shared quick-action menu for a QR Calling vehicle — used both on the
 * Vehicles list (so admin doesn't have to open the detail page for routine
 * actions) and on the vehicle detail page itself. Same actions either way:
 * pause/resume, edit contact number, set/clear a validity end date, and
 * reassign to a different owner (dispute resolution).
 */
export const VehicleActionsMenu = ({ vehicle, onChanged }: { vehicle: VehicleActionTarget; onChanged: () => void }) => {
  const [modal, setModal] = useState<'none' | 'contact' | 'validity' | 'reassign'>('none');

  const toggleStatus = useMutation({
    mutationFn: () =>
      api.patch(`/admin/qr/vehicles/${vehicle.id}/status`, { status: vehicle.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }),
    onSuccess: onChanged,
  });

  const clearValidity = useMutation({
    mutationFn: () => api.patch(`/admin/qr/vehicles/${vehicle.id}/validity`, { validUntil: null }),
    onSuccess: onChanged,
  });

  const canToggle = vehicle.status === 'ACTIVE' || vehicle.status === 'PAUSED';

  return (
    <>
      <div onClick={(e) => e.stopPropagation()}>
        <KebabMenu>
          {canToggle && (
            <MenuItem
              icon={vehicle.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              onClick={() => toggleStatus.mutate()}
              disabled={toggleStatus.isPending}
            >
              {vehicle.status === 'ACTIVE' ? 'Pause calls' : 'Resume calls'}
            </MenuItem>
          )}
          <MenuItem icon={<Phone className="h-4 w-4" />} onClick={() => setModal('contact')}>
            Edit contact number
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<CalendarClock className="h-4 w-4" />} onClick={() => setModal('validity')}>
            Set QR validity
          </MenuItem>
          {vehicle.validUntil && (
            <MenuItem
              icon={<InfinityIcon className="h-4 w-4" />}
              onClick={() => clearValidity.mutate()}
              disabled={clearValidity.isPending}
            >
              Make lifetime validity
            </MenuItem>
          )}
          <MenuDivider />
          <MenuItem icon={<UserCog className="h-4 w-4" />} onClick={() => setModal('reassign')}>
            Reassign to a different owner
          </MenuItem>
        </KebabMenu>
      </div>

      {modal === 'contact' && (
        <EditContactModal vehicleId={vehicle.id} current={vehicle.contactPhone} onClose={() => setModal('none')} onSaved={onChanged} />
      )}
      {modal === 'validity' && (
        <SetValidityModal vehicleId={vehicle.id} current={vehicle.validUntil} onClose={() => setModal('none')} onSaved={onChanged} />
      )}
      {modal === 'reassign' && (
        <ReassignModal vehicleId={vehicle.id} onClose={() => setModal('none')} onSaved={onChanged} />
      )}
    </>
  );
};

export const ModalShell = ({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      {children}
    </div>
  </div>
);

const EditContactModal = ({
  vehicleId, current, onClose, onSaved,
}: { vehicleId: string; current: string; onClose: () => void; onSaved: () => void }) => {
  const [value, setValue] = useState(current);

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/qr/vehicles/${vehicleId}/contact`, { contactPhone: value.trim() }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  return (
    <ModalShell title="Edit contact number" subtitle="The number that rings when someone scans this car's QR." onClose={onClose}>
      <input
        autoFocus
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
        className="input mt-3 w-full"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not update')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || value.trim().length < 8}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </ModalShell>
  );
};

const ReassignModal = ({
  vehicleId, onClose, onSaved,
}: { vehicleId: string; onClose: () => void; onSaved: () => void }) => {
  const [email, setEmail] = useState('');

  const save = useMutation({
    mutationFn: () => api.post(`/admin/qr/vehicles/${vehicleId}/reassign`, { ownerEmail: email.trim() }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  return (
    <ModalShell
      title="Reassign to a different owner"
      subtitle="Dispute resolution — the plate belongs to someone other than whoever registered it first. The new owner needs an AutoSahay account already."
      onClose={onClose}
    >
      <input
        autoFocus
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="owner@example.com"
        className="input mt-3 w-full"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not reassign — check the email is correct.')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !email.trim()}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Reassigning…' : 'Reassign'}
      </button>
    </ModalShell>
  );
};

const SetValidityModal = ({
  vehicleId, current, onClose, onSaved,
}: { vehicleId: string; current: string | null; onClose: () => void; onSaved: () => void }) => {
  const [value, setValue] = useState(current ? current.slice(0, 10) : '');

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/qr/vehicles/${vehicleId}/validity`, { validUntil: new Date(`${value}T23:59:59`).toISOString() }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  return (
    <ModalShell
      title="Set QR validity"
      subtitle="Lifetime by default. Past this date, the sticker stops resolving until extended or cleared."
      onClose={onClose}
    >
      <input
        autoFocus
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input mt-3 w-full"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not update validity')}</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !value}
        className="btn-primary mt-4 w-full justify-center"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </ModalShell>
  );
};
