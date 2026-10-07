import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { errMsg } from '@/lib/qrCallingFormat';
import { digits10, isPhone10, phoneInputProps } from '@/lib/phone';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MAX_CONTACTS = 5;

interface Detail {
  id: string; plateNumber: string; vehicleType: 'CAR' | 'BIKE'; contactPhone: string; ownerName: string | null;
  silentFrom: string | null; silentTo: string | null; emergencyPublic: boolean;
  bloodGroup: string | null; medicalNotes: string | null;
  owner: { fullName: string; email: string; phone: string | null };
  emergencyContacts: { id: string; name: string; relation: string | null; phone: string; showPublic: boolean }[];
}
interface ContactRow { name: string; relation: string; phone: string; showPublic: boolean }
interface FormState {
  plateNumber: string; vehicleType: 'CAR' | 'BIKE'; contactPhone: string; ownerName: string;
  customerName: string; customerPhone: string;
  silentOn: boolean; silentFrom: string; silentTo: string;
  emergencyPublic: boolean; bloodGroup: string; medicalNotes: string; contacts: ContactRow[];
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>
);

/** Right-side drawer: admin edits a registered customer's vehicle, account and emergency details. */
export const QrVehicleEditDrawer = ({
  vehicleId, onClose, onSaved,
}: { vehicleId: string; onClose: () => void; onSaved: () => void }) => {
  const { data, isLoading } = useQuery<{ vehicle: Detail }>({
    queryKey: ['admin-qr-vehicle', vehicleId],
    queryFn: async () => (await api.get(`/admin/qr/vehicles/${vehicleId}`)).data,
  });
  const v = data?.vehicle;

  const [f, setF] = useState<FormState | null>(null);

  useEffect(() => {
    if (!v) return;
    setF({
      plateNumber: v.plateNumber, vehicleType: v.vehicleType, contactPhone: digits10(v.contactPhone),
      ownerName: v.ownerName ?? '', customerName: v.owner.fullName, customerPhone: digits10(v.owner.phone ?? ''),
      silentOn: !!(v.silentFrom || v.silentTo), silentFrom: v.silentFrom ?? '', silentTo: v.silentTo ?? '',
      emergencyPublic: v.emergencyPublic, bloodGroup: v.bloodGroup ?? '', medicalNotes: v.medicalNotes ?? '',
      contacts: v.emergencyContacts.map((c) => ({ name: c.name, relation: c.relation ?? '', phone: digits10(c.phone), showPublic: c.showPublic })),
    });
  }, [v]);

  const save = useMutation({
    mutationFn: () => {
      if (!f || !v) throw new Error('not loaded');
      const customer: Record<string, string> = {};
      if (f.customerName.trim() !== v.owner.fullName) customer.fullName = f.customerName.trim();
      if (f.customerPhone && f.customerPhone !== digits10(v.owner.phone ?? '')) customer.phone = f.customerPhone;
      return api.patch(`/admin/qr/vehicles/${vehicleId}`, {
        vehicleType: f.vehicleType,
        ...(f.plateNumber.trim().toUpperCase() !== v.plateNumber ? { plateNumber: f.plateNumber.trim() } : {}),
        contactPhone: f.contactPhone,
        ownerName: f.ownerName.trim() || null,
        silentFrom: f.silentOn ? (f.silentFrom || null) : null,
        silentTo: f.silentOn ? (f.silentTo || null) : null,
        emergencyPublic: f.emergencyPublic,
        bloodGroup: f.bloodGroup || null,
        medicalNotes: f.medicalNotes.trim() || null,
        emergencyContacts: f.contacts.map((c) => ({
          name: c.name.trim(), relation: c.relation.trim() || undefined, phone: c.phone, showPublic: c.showPublic,
        })),
        ...(Object.keys(customer).length ? { customer } : {}),
      });
    },
    onSuccess: () => { onSaved(); onClose(); },
  });

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) =>
    setF((p) => (p ? { ...p, [k]: val } : p));
  const setContact = (i: number, patch: Partial<ContactRow>) =>
    setF((p) => (p ? { ...p, contacts: p.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : p));

  const valid = !!f && f.plateNumber.trim().length >= 4 && isPhone10(f.contactPhone) && f.customerName.trim().length >= 2
    && (!f.customerPhone || isPhone10(f.customerPhone))
    && f.contacts.every((c) => c.name.trim().length > 0 && isPhone10(c.phone));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold">Edit customer details</h3>
            <p className="text-xs text-slate-500">Vehicle, account and emergency information.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {isLoading || !f ? <p className="text-sm text-slate-400">Loading…</p> : (
            <>
              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Vehicle</h4>
                <div>
                  <Label>Vehicle type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['CAR', 'BIKE'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => set('vehicleType', t)}
                        className={cn('rounded-lg border-2 px-3 py-1.5 text-sm font-semibold',
                          f.vehicleType === t ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>
                        {t === 'CAR' ? 'Car' : 'Bike'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Number plate</Label>
                  <input className="input w-full font-mono uppercase" value={f.plateNumber} onChange={(e) => set('plateNumber', e.target.value)} />
                </div>
                <div>
                  <Label>Contact number (rings on scan)</Label>
                  <input {...phoneInputProps} className="input w-full" value={f.contactPhone} onChange={(e) => set('contactPhone', digits10(e.target.value))} placeholder="10-digit mobile" />
                </div>
                <div>
                  <Label>Owner name on card</Label>
                  <input className="input w-full" value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.silentOn} onChange={(e) => set('silentOn', e.target.checked)} /> Silent hours
                </label>
                {f.silentOn && (
                  <div className="flex items-center gap-2">
                    <input type="time" className="input w-32" value={f.silentFrom} onChange={(e) => set('silentFrom', e.target.value)} />
                    <span>→</span>
                    <input type="time" className="input w-32" value={f.silentTo} onChange={(e) => set('silentTo', e.target.value)} />
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Account holder</h4>
                <div>
                  <Label>Name</Label>
                  <input className="input w-full" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} />
                </div>
                <div>
                  <Label>Mobile number</Label>
                  <input {...phoneInputProps} className="input w-full" value={f.customerPhone} onChange={(e) => set('customerPhone', digits10(e.target.value))} placeholder="10-digit mobile" />
                </div>
                <p className="text-xs text-slate-400">Email ({v?.owner.email}) can&apos;t be changed here — it is their login.</p>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold">Emergency details</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.emergencyPublic} onChange={(e) => set('emergencyPublic', e.target.checked)} /> Show emergency card publicly on scan
                </label>
                <div className="w-40">
                  <Label>Blood group</Label>
                  <select className="input w-full" value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                    <option value="">—</option>
                    {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Medical notes</Label>
                  <textarea rows={2} className="input w-full resize-none" value={f.medicalNotes} onChange={(e) => set('medicalNotes', e.target.value)} />
                </div>

                <div className="space-y-3">
                  <Label>Emergency contacts ({f.contacts.length}/{MAX_CONTACTS})</Label>
                  {f.contacts.map((c, i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex gap-2">
                        <input className="input flex-1" placeholder="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                        <input className="input w-28" placeholder="Relation" value={c.relation} onChange={(e) => setContact(i, { relation: e.target.value })} />
                        <button type="button" onClick={() => set('contacts', f.contacts.filter((_, j) => j !== i))} className="rounded p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="flex items-center gap-3">
                        <input {...phoneInputProps} className={cn('input flex-1', c.phone && !isPhone10(c.phone) && 'border-rose-500')} placeholder="10-digit mobile" value={c.phone} onChange={(e) => setContact(i, { phone: digits10(e.target.value) })} />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                          <input type="checkbox" checked={c.showPublic} onChange={(e) => setContact(i, { showPublic: e.target.checked })} /> Show on card
                        </label>
                      </div>
                    </div>
                  ))}
                  {f.contacts.length < MAX_CONTACTS && (
                    <button type="button" onClick={() => set('contacts', [...f.contacts, { name: '', relation: '', phone: '', showPublic: true }])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                      <Plus className="h-4 w-4" /> Add contact
                    </button>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          {save.isError && <p className="mb-2 text-xs text-rose-600">{errMsg(save.error, 'Could not save changes')}</p>}
          <button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending} className="btn-primary w-full justify-center">
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </aside>
    </>
  );
};
