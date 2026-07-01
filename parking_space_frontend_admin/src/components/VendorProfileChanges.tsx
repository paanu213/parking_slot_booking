import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ChangeTable, computeChanges } from '@/components/ChangeTable';

/**
 * Current-vs-requested diff for a vendor's pending profile edits
 * (vendor.pendingProfileData), plus inline Approve / Reject Changes actions —
 * mirrors the space pending-edits flow. Calls onDone(message) so the parent can
 * refetch and surface a persistent success banner.
 */
const VENDOR_LABELS: Record<string, string> = {
  fullName:     'Owner Name',
  phone:        'Owner Phone',
  email:        'Owner Email',
  businessName: 'Business Name',
  contactPhone: 'Contact Phone',
  address:      'Address',
  gstNumber:    'GST Number',
  panNumber:    'PAN Number',
  payoutUpiId:  'Payout UPI',
  aadharNumber: 'Aadhaar Number',
  aadharDocUrl: 'Aadhaar Document',
};

export const VendorProfileChanges = ({ vendor, onDone }: { vendor: any; onDone: (message: string) => void }) => {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/vendors/${vendor.id}/approve-profile`),
    onSuccess: () => onDone('Profile changes approved and applied to the vendor.'),
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admin/vendors/${vendor.id}/reject-profile`, { note: note || undefined }),
    onSuccess: () => onDone('Profile changes rejected — the vendor keeps their current details.'),
  });

  if (!vendor?.pendingProfileData) return null;

  const current = (k: string) => {
    if (k === 'fullName') return vendor.user?.fullName;
    if (k === 'phone') return vendor.user?.phone;
    if (k === 'email') return vendor.user?.email;
    return vendor[k];
  };
  const rows = computeChanges(vendor.pendingProfileData, current, VENDOR_LABELS);
  const fmt = (key: string, value: unknown) => {
    if (key !== 'aadharDocUrl') return undefined;
    const url = String(value ?? '').trim();
    if (!url) return '—';
    // Let the admin open & inspect the uploaded doc before approving.
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
      >
        View document
      </a>
    );
  };

  return (
    <div className="card overflow-hidden">
      <ChangeTable
        rows={rows}
        title="Requested profile changes — review before approving"
        submittedAt={vendor.updatedAt}
        formatValue={fmt}
      />
      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        {rejecting ? (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">
              Reason for rejecting these changes (optional — shown to the vendor)
            </label>
            <textarea
              className="input w-full text-sm"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. GST number invalid, name mismatch…"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => reject.mutate()}
                disabled={reject.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {reject.isPending ? 'Rejecting…' : 'Confirm Reject Changes'}
              </button>
              <button onClick={() => { setRejecting(false); setNote(''); }} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="btn-primary inline-flex items-center gap-1.5 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {approve.isPending ? 'Approving…' : 'Approve Changes'}
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
