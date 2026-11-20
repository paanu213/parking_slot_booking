import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { statusCls, fmtDateTime } from '@/lib/qrCallingFormat';
import { MaskedPhone } from '@/components/MaskedPhone';
import { VehicleTypeBadge } from '@/components/QrFilters';
import { QrVehicleEditDrawer } from '@/components/QrVehicleEditDrawer';
import { VehicleActionsMenu } from '@/components/VehicleActionsMenu';
import { VehicleChangeHistory } from '@/components/VehicleChangeHistory';

interface VehicleOwner { id: string; fullName: string; email: string; phone: string | null }

interface VehicleDetail {
  id: string; plateNumber: string; vehicleType: 'CAR' | 'BIKE'; city: string | null; state: string | null;
  contactPhone: string; contactVerified: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'TRANSFERRED' | 'DELETED';
  isActive: boolean; silentFrom: string | null; silentTo: string | null;
  emergencyPublic: boolean; ownerName: string | null;
  bloodGroup: string | null; medicalNotes: string | null;
  validUntil: string | null; validityCustom?: boolean;
  owner: VehicleOwner;
  linkedSticker: { token: string; url: string; claimedAt: string | null; batch: { id: string; label: string } | null } | null;
  emergencyContacts: { id: string; name: string; relation: string | null; phone: string; showPublic: boolean }[];
  calls: { id: string; status: string; provider: string; initiatedAt: string; answeredAt: string | null; endedAt: string | null; durationSec: number | null; callerMasked: string }[];
  createdAt: string; updatedAt: string;
}

/**
 * Full-page vehicle detail — was a modal opened from the Vehicles table;
 * moved to its own route (/qr-calling/vehicles/:id) so it's linkable,
 * back/forward-navigable, and has room to breathe.
 */
export const QrVehicleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery<{ vehicle: VehicleDetail }>({
    queryKey: ['admin-qr-vehicle', id],
    queryFn: async () => (await api.get(`/admin/qr/vehicles/${id}`)).data,
  });
  const v = data?.vehicle;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-qr-vehicle', id] });
    qc.invalidateQueries({ queryKey: ['admin-qr-vehicles'] });
  };

  const validityLabel = (validUntil: string | null, custom?: boolean) =>
    validUntil
      ? `${new Date(validUntil).getTime() < Date.now() ? 'Expired' : 'Valid until'} ${new Date(validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${custom ? ' (custom date)' : ' (10-year default)'}`
      : '10 years from registration';

  return (
    <section className="space-y-5 p-6">
      <div>
        <button
          onClick={() => navigate('/qr-calling')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to QR Calling
        </button>

        {isLoading || !v ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border-2 border-slate-800 bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-wider dark:border-slate-300 dark:bg-slate-800">
                {v.plateNumber}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(v.status))}>{v.status}</span>
              <VehicleTypeBadge type={v.vehicleType} />
            </div>
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost text-sm"><Pencil className="mr-1 h-4 w-4" /> Edit details</button>
            <VehicleActionsMenu
              vehicle={{ id: v.id, status: v.status, contactPhone: v.contactPhone, validUntil: v.validUntil, validityCustom: v.validityCustom }}
              onChanged={refresh}
            />
          </div>
        )}
      </div>

      {!isLoading && v && (
        <div className="max-w-3xl space-y-5">
          <div className="card grid grid-cols-2 gap-3 p-5 text-sm">
            <Field label="Owner account" value={`${v.owner.fullName} · ${v.owner.email}`} />
            <Field label="Contact number" value={v.contactPhone} />
            <Field label="Owner phone" value={v.owner.phone ?? '-'} />
            <Field label="Location" value={[v.city, v.state].filter(Boolean).join(', ') || '-'} />
            <Field label="Owner name (ICE)" value={v.ownerName ?? '-'} />
            <Field label="Silent hours" value={v.silentFrom || v.silentTo ? `${v.silentFrom ?? '-'} → ${v.silentTo ?? '-'}` : '-'} />
            <Field label="Emergency card" value={v.emergencyPublic ? 'On' : 'Off'} />
            <Field label="QR validity" value={validityLabel(v.validUntil, v.validityCustom)} />
            <Field label="Linked QR sticker" value={v.linkedSticker ? v.linkedSticker.token : 'Not linked yet'} />
            <Field label="QR batch" value={v.linkedSticker?.batch?.label ?? '-'} />
          </div>

          {(v.emergencyPublic || v.bloodGroup || v.medicalNotes || v.emergencyContacts.length > 0) && (
            <div className="card p-5">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency details {v.emergencyPublic ? '(card public)' : '(card off, admin view)'}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Blood group" value={v.bloodGroup ?? '-'} />
                <Field label="Medical notes" value={v.medicalNotes ?? '-'} />
              </div>
              {v.emergencyContacts.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {v.emergencyContacts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {c.name}{c.relation ? ` (${c.relation})` : ''}, {c.phone}
                      {!c.showPublic && <span className="text-xs text-slate-400">(hidden)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="card p-5">
            <VehicleChangeHistory vehicleId={v.id} />
          </div>

          <div className="card p-5">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent calls</h3>
            {v.calls.length === 0 ? (
              <p className="text-xs text-slate-400">No calls yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Caller</th><th>Status</th><th>When</th><th>Duration</th></tr></thead>
                <tbody>
                  {v.calls.slice(0, 10).map((c) => (
                    <tr key={c.id}>
                      <td><MaskedPhone masked={c.callerMasked} callId={c.id} /></td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(c.status))}>{c.status}</span></td>
                      <td className="text-xs text-slate-400">{fmtDateTime(c.initiatedAt)}</td>
                      <td>{c.durationSec != null ? `${c.durationSec}s` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}
      {editing && <QrVehicleEditDrawer vehicleId={v!.id} onClose={() => setEditing(false)} onSaved={refresh} />}
    </section>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);
