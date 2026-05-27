/**
 * EditSpaceSlideOver — quick-edit panel for parking space basic fields.
 * Slides in from the right; closes on backdrop click or Cancel.
 *
 * Edits: name, description, addressLine, area, city, state, pincode.
 * For image/amenity/map-coordinate editing, link to the full SpaceEditPage.
 *
 * Per CLAUDE.md:
 *  - Slide-over uses `ml-auto flex h-full flex-col` — no overflow-hidden ancestors.
 *  - Backdrop is fixed inset-0 z-40, panel is fixed inset-y-0 right-0 z-50.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface SpaceShape {
  id: string;
  name?: string;
  description?: string;
  addressLine?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface Props {
  space: SpaceShape;
  onClose: () => void;
  onSaved?: () => void;
}

export const EditSpaceSlideOver = ({ space, onClose, onSaved }: Props) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:        space.name        ?? '',
    description: space.description ?? '',
    addressLine: space.addressLine ?? '',
    area:        space.area        ?? '',
    city:        space.city        ?? '',
    state:       space.state       ?? '',
    pincode:     space.pincode     ?? '',
  });

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/spaces/${space.id}`, form),
    onSuccess: () => {
      // Refresh anything that may show this space
      qc.invalidateQueries({ queryKey: ['vendor-details'] });
      qc.invalidateQueries({ queryKey: ['admin-spaces'] });
      qc.invalidateQueries({ queryKey: ['admin-space', space.id] });
      onSaved?.();
      onClose();
    },
  });

  const set = <K extends keyof typeof form>(key: K, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] ml-auto flex h-full flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">Edit Parking Space</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{space.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <Field label="Space Name" required>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Brigade Road Parking"
              />
            </Field>

            <Field label="Description">
              <textarea
                className="input w-full"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional — visible to customers"
              />
            </Field>

            <Field label="Address Line" required>
              <input
                className="input w-full"
                value={form.addressLine}
                onChange={(e) => set('addressLine', e.target.value)}
                placeholder="Street, building, landmark"
              />
            </Field>

            <Field label="Area / Locality">
              <input
                className="input w-full"
                value={form.area}
                onChange={(e) => set('area', e.target.value)}
                placeholder="e.g. Indiranagar"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City" required>
                <input
                  className="input w-full"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
              <Field label="State" required>
                <input
                  className="input w-full"
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Pincode" required>
              <input
                className="input w-40"
                value={form.pincode}
                onChange={(e) => set('pincode', e.target.value)}
              />
            </Field>

            {save.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
                Failed to save changes. Check the fields and try again.
              </div>
            )}

            {/* Advanced editor link */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/40">
              <p className="font-medium text-slate-600 dark:text-slate-300">
                Need to edit images, amenities, or map coordinates?
              </p>
              <a
                href={`/spaces/${space.id}/edit`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
              >
                Open full editor in new tab <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button onClick={onClose} className="btn-ghost text-sm" disabled={save.isPending}>
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            className="btn-primary flex items-center gap-1.5 text-sm"
            disabled={save.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
};

const Field = ({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);
