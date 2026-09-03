import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, Plus, ShieldPlus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import type { Vehicle } from '@/pages/MyVehiclesPage';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MAX_CONTACTS = 5;

interface ContactForm {
  name: string;
  relation: string;
  phone: string;
  showPublic: boolean;
}

interface VehicleForm {
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  silentFrom: string;
  silentTo: string;
  dailyReceiveCap: number;
  emergencyPublic: boolean;
  bloodGroup: string;
  medicalNotes: string;
  emergencyContacts: ContactForm[];
}

const EMPTY: VehicleForm = {
  plateNumber: '',
  contactPhone: '',
  ownerName: '',
  silentFrom: '',
  silentTo: '',
  dailyReceiveCap: 15,
  emergencyPublic: false,
  bloodGroup: '',
  medicalNotes: '',
  emergencyContacts: [],
};

/**
 * Slide-over for registering / editing a vehicle — car + contact, call
 * preferences, and the opt-in emergency (ICE) card. No OTP/SMS step: a newly
 * registered car goes straight to ACTIVE (`contactVerified` stays `false`
 * server-side, a placeholder for missed-call verification added once
 * telephony lands — see CLAUDE.md).
 *
 * Per CLAUDE.md §4: no `overflow-hidden` ancestor; the form body scrolls on
 * its own (`overflow-y-auto`) inside the fixed-height flex column.
 */
export const VehicleFormDrawer = ({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) => {
  const qc = useQueryClient();
  const isEdit = !!vehicle;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleForm>({ defaultValues: EMPTY });

  const { fields, append, remove } = useFieldArray({ control, name: 'emergencyContacts' });
  const emergencyPublic = watch('emergencyPublic');

  useEffect(() => {
    if (!vehicle) {
      reset(EMPTY);
      return;
    }
    reset({
      plateNumber:     vehicle.plateNumber,
      contactPhone:    vehicle.contactPhone,
      ownerName:       vehicle.ownerName ?? '',
      silentFrom:      vehicle.silentFrom ?? '',
      silentTo:        vehicle.silentTo ?? '',
      dailyReceiveCap: vehicle.dailyReceiveCap,
      emergencyPublic: vehicle.emergencyPublic,
      bloodGroup:      vehicle.bloodGroup ?? '',
      medicalNotes:    vehicle.medicalNotes ?? '',
      emergencyContacts: vehicle.emergencyContacts.map((c) => ({
        name: c.name, relation: c.relation ?? '', phone: c.phone, showPublic: c.showPublic,
      })),
    });
  }, [vehicle, reset]);

  const save = useMutation({
    mutationFn: (vals: VehicleForm) => {
      const payload: Record<string, unknown> = {
        contactPhone:    vals.contactPhone.trim(),
        ownerName:       vals.ownerName.trim() || undefined,
        silentFrom:      vals.silentFrom || undefined,
        silentTo:        vals.silentTo || undefined,
        dailyReceiveCap: Number(vals.dailyReceiveCap) || 15,
        emergencyPublic: vals.emergencyPublic,
        bloodGroup:      vals.emergencyPublic ? (vals.bloodGroup || undefined) : undefined,
        medicalNotes:    vals.emergencyPublic ? (vals.medicalNotes.trim() || undefined) : undefined,
        emergencyContacts: vals.emergencyPublic
          ? vals.emergencyContacts.map((c) => ({
              name:       c.name.trim(),
              relation:   c.relation.trim() || undefined,
              phone:      c.phone.trim(),
              showPublic: c.showPublic,
            }))
          : [],
      };
      if (isEdit) return api.put(`/customer/me/vehicles/${vehicle!.id}`, payload);
      return api.post('/customer/me/vehicles', { ...payload, plateNumber: vals.plateNumber.trim() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-vehicles'] });
      toast.success(
        isEdit ? 'Vehicle updated' : 'Vehicle registered',
        isEdit ? 'Your changes have been saved.' : 'Your car is now live for scan-to-call.',
      );
      onClose();
    },
    onError: (e: any) =>
      toast.error('Could not save', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'),
  });

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/40" aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Car className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">{isEdit ? 'Edit vehicle' : 'Register a vehicle'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit ? vehicle!.plateNumber : 'For scan-to-call + emergency card'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <form
          id="vehicle-form"
          onSubmit={handleSubmit((v) => save.mutate(v))}
          className="flex-1 space-y-7 overflow-y-auto px-5 py-5"
        >
          {/* Car & contact */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Car & contact</h3>

            <div>
              <label className="text-sm font-medium">Number plate</label>
              <input
                disabled={isEdit}
                className={cn(
                  'input mt-1 w-full font-mono uppercase tracking-wide',
                  errors.plateNumber && 'border-rose-500',
                  isEdit && 'cursor-not-allowed opacity-60',
                )}
                placeholder="AP16HJ7956"
                {...register('plateNumber', {
                  required: !isEdit && 'Enter the car number',
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
                  },
                  pattern: { value: /^[A-Z0-9]{6,12}$/, message: 'Enter a valid car number' },
                })}
              />
              {errors.plateNumber && <p className="mt-1 text-xs text-rose-600">{errors.plateNumber.message}</p>}
              {isEdit && (
                <p className="mt-1 text-xs text-slate-400">
                  Plate can't be changed — delete and re-register if you made a mistake.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Contact number</label>
              <input
                type="tel"
                className={cn('input mt-1 w-full', errors.contactPhone && 'border-rose-500')}
                placeholder="Number that rings when someone scans your QR"
                {...register('contactPhone', {
                  required: 'Enter the number to ring',
                  minLength: { value: 8, message: 'Too short' },
                })}
              />
              {errors.contactPhone && <p className="mt-1 text-xs text-rose-600">{errors.contactPhone.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium">
                Owner name <span className="text-xs text-slate-400">(optional)</span>
              </label>
              <input className="input mt-1 w-full" placeholder="Shown on the emergency card, if enabled" {...register('ownerName')} />
            </div>
          </section>

          {/* Call preferences */}
          <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Call preferences</h3>

            <div>
              <label className="text-sm font-medium">
                Silent hours <span className="text-xs text-slate-400">(optional — no calls during this window)</span>
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input type="time" className="input w-36 sm:w-40" {...register('silentFrom')} />
                <span className="text-slate-400">→</span>
                <input type="time" className="input w-36 sm:w-40" {...register('silentTo')} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Max calls received per day</label>
              <input
                type="number"
                min={1}
                max={100}
                className={cn('input mt-1 w-28', errors.dailyReceiveCap && 'border-rose-500')}
                {...register('dailyReceiveCap', {
                  required: true,
                  min: { value: 1, message: 'At least 1' },
                  max: { value: 100, message: 'At most 100' },
                  valueAsNumber: true,
                })}
              />
              <p className="mt-1 text-xs text-slate-400">Caps how many calls you can receive on this car in a day.</p>
            </div>
          </section>

          {/* Emergency (ICE) card */}
          <section className="space-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldPlus className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Emergency card</h3>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" {...register('emergencyPublic')} />
                <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 dark:bg-slate-700" />
                <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Off by default. When on, a scanner sees this — blood group, notes, and family
              contacts — after entering your full plate. Every field here is optional.
            </p>

            {emergencyPublic && (
              <div className="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
                <div>
                  <label className="text-sm font-medium">Blood group</label>
                  <select className="input mt-1 w-full" {...register('bloodGroup')}>
                    <option value="">Not specified</option>
                    {BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
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

                  {fields.length === 0 && (
                    <p className="text-xs text-slate-400">No family contacts added yet.</p>
                  )}

                  {fields.map((field, i) => (
                    <div key={field.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center gap-2">
                        <input
                          className="input flex-1"
                          placeholder="Name"
                          {...register(`emergencyContacts.${i}.name` as const, { required: true })}
                        />
                        <input
                          className="input w-24"
                          placeholder="Relation"
                          {...register(`emergencyContacts.${i}.relation` as const)}
                        />
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
                          type="tel"
                          className="input flex-1"
                          placeholder="Phone number"
                          {...register(`emergencyContacts.${i}.phone` as const, { required: true, minLength: 8 })}
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
          </section>
        </form>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button
            type="submit"
            form="vehicle-form"
            disabled={isSubmitting || save.isPending}
            className="btn-primary w-full justify-center"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Register vehicle'}
          </button>
        </div>
      </div>
    </>
  );
};
