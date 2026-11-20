import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, Plus, ShieldPlus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { phoneInputProps, phoneRules, sanitizePhone } from '@/lib/phone';
import { VehicleTypePicker, type VehicleKind } from '@/components/VehicleTypePicker';
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
  vehicleType: VehicleKind;
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  silentHoursEnabled: boolean;
  silentFrom: string;
  silentTo: string;
  emergencyPublic: boolean;
  bloodGroup: string;
  medicalNotes: string;
  emergencyContacts: ContactForm[];
}

const EMPTY: VehicleForm = {
  vehicleType: 'CAR',
  plateNumber: '',
  contactPhone: '',
  ownerName: '',
  silentHoursEnabled: false,
  silentFrom: '',
  silentTo: '',
  emergencyPublic: false,
  bloodGroup: '',
  medicalNotes: '',
  emergencyContacts: [],
};

/**
 * Slide-over for editing a vehicle's contact, call preferences, and the
 * opt-in emergency (ICE) card. Vehicles are only ever created via the paid
 * "Get QR sticker" checkout (QrCallingLandingPage) — this drawer is
 * edit-only, never registration, so a vehicle can't exist here without a
 * QR order behind it.
 *
 * Per CLAUDE.md §4: no `overflow-hidden` ancestor; the form body scrolls on
 * its own (`overflow-y-auto`) inside the fixed-height flex column.
 */
export const VehicleFormDrawer = ({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) => {
  const qc = useQueryClient();

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
  const silentHoursEnabled = watch('silentHoursEnabled');
  const vehicleType = watch('vehicleType');

  useEffect(() => {
    reset({
      vehicleType:     vehicle.vehicleType === 'BIKE' ? 'BIKE' : 'CAR',
      plateNumber:     vehicle.plateNumber,
      contactPhone:    sanitizePhone(vehicle.contactPhone),
      ownerName:       vehicle.ownerName ?? '',
      silentHoursEnabled: !!(vehicle.silentFrom || vehicle.silentTo),
      silentFrom:      vehicle.silentFrom ?? '',
      silentTo:        vehicle.silentTo ?? '',
      emergencyPublic: vehicle.emergencyPublic,
      bloodGroup:      vehicle.bloodGroup ?? '',
      medicalNotes:    vehicle.medicalNotes ?? '',
      emergencyContacts: vehicle.emergencyContacts.map((c) => ({
        name: c.name, relation: c.relation ?? '', phone: sanitizePhone(c.phone), showPublic: c.showPublic,
      })),
    });
  }, [vehicle, reset]);

  const save = useMutation({
    mutationFn: (vals: VehicleForm) => {
      // This PUT always sends the form's full current state, so an emptied
      // field must send `null` (clear it) — `undefined` would get dropped by
      // JSON.stringify and silently mean "leave the old value untouched".
      const payload: Record<string, unknown> = {
        vehicleType:     vals.vehicleType,
        contactPhone:    vals.contactPhone.trim(),
        ownerName:       vals.ownerName.trim() || null,
        // Toggled off always clears both, regardless of whatever's still
        // sitting in the (hidden) time inputs from before it was switched off.
        silentFrom:      vals.silentHoursEnabled ? (vals.silentFrom || null) : null,
        silentTo:        vals.silentHoursEnabled ? (vals.silentTo || null) : null,
        emergencyPublic: vals.emergencyPublic,
        bloodGroup:      vals.emergencyPublic ? (vals.bloodGroup || null) : null,
        medicalNotes:    vals.emergencyPublic ? (vals.medicalNotes.trim() || null) : null,
        emergencyContacts: vals.emergencyPublic
          ? vals.emergencyContacts.map((c) => ({
              name:       c.name.trim(),
              relation:   c.relation.trim() || undefined,
              phone:      c.phone.trim(),
              showPublic: c.showPublic,
            }))
          : [],
      };
      return api.put(`/customer/me/vehicles/${vehicle.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-vehicles'] });
      toast.success('Vehicle updated', 'Your changes have been saved.');
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
              <h2 className="font-display text-lg font-bold">Edit vehicle</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{vehicle.plateNumber}</p>
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

            <VehicleTypePicker value={vehicleType} onChange={(v) => setValue('vehicleType', v, { shouldDirty: true })} />

            <div>
              <label className="text-sm font-medium">Number plate</label>
              <input
                disabled
                className="input mt-1 w-full cursor-not-allowed font-mono uppercase tracking-wide opacity-60"
                {...register('plateNumber')}
              />
              <p className="mt-1 text-xs text-slate-400">
                Plate can't be changed. Remove and re-order a QR sticker if you made a mistake.
              </p>
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Silent hours <span className="text-xs text-slate-400">(no calls during a set window)</span>
                </label>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    {...register('silentHoursEnabled', {
                      onChange: (e) => {
                        // Switching off doesn't need to clear the inputs — the
                        // save payload ignores them whenever this is off — but
                        // switching on with nothing set yet gets a sane default.
                        if (e.target.checked && !watch('silentFrom') && !watch('silentTo')) {
                          setValue('silentFrom', '22:00', { shouldDirty: true });
                          setValue('silentTo', '07:00', { shouldDirty: true });
                        }
                      },
                    })}
                  />
                  <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 dark:bg-slate-700" />
                  <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-4" />
                </label>
              </div>

              {silentHoursEnabled && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className={cn('input w-36 sm:w-40', errors.silentFrom && 'border-rose-500')}
                      {...register('silentFrom', { validate: (v) => !silentHoursEnabled || !!v || 'Set a start time' })}
                    />
                    <span className="text-slate-400">→</span>
                    <input
                      type="time"
                      className={cn('input w-36 sm:w-40', errors.silentTo && 'border-rose-500')}
                      {...register('silentTo', { validate: (v) => !silentHoursEnabled || !!v || 'Set an end time' })}
                    />
                  </div>
                  {(errors.silentFrom || errors.silentTo) && (
                    <p className="mt-1 text-xs text-rose-600">{errors.silentFrom?.message ?? errors.silentTo?.message}</p>
                  )}
                </div>
              )}
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
              Off by default. When on, a scanner sees this: blood group, notes, and family
              contacts, after entering your full plate. Every field here is optional.
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
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
};
