import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ChangeTable, diffObjects } from '@/components/ChangeTable';

/**
 * Current-vs-requested diff for a vendor's pending profile edits, plus inline
 * Approve / Reject Changes actions. Profile edits accumulate as a LIST of
 * requests (each a full field snapshot), so a vendor can submit several
 * modifications before an admin acts — the admin sees every one and approves or
 * rejects the whole set. Mirrors the space pending-edits flow.
 * Calls onDone(message) so the parent can refetch and surface a success banner.
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

type EditRequest = { data: Record<string, unknown>; submittedAt: string };

const parseRequests = (pendingData: unknown): EditRequest[] => {
  if (!pendingData || typeof pendingData !== 'string') return [];
  try {
    const parsed = JSON.parse(pendingData);
    if (Array.isArray(parsed)) return parsed.filter((e) => e && typeof e === 'object' && e.data);
    if (parsed && typeof parsed === 'object') return [{ data: parsed, submittedAt: '' }]; // legacy single object
  } catch { /* ignore */ }
  return [];
};

// Render the Aadhaar document field as an openable link inside the diff table.
const fmt = (key: string, value: unknown) => {
  if (key !== 'aadharDocUrl') return undefined;
  const url = String(value ?? '').trim();
  if (!url) return '-';
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400">
      View document
    </a>
  );
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
    onSuccess: () => onDone('Profile changes rejected, the vendor keeps their current details.'),
  });

  const requests = parseRequests(vendor?.pendingProfileData);
  if (requests.length === 0) return null;

  const current = (k: string) => {
    if (k === 'fullName') return vendor.user?.fullName;
    if (k === 'phone') return vendor.user?.phone;
    if (k === 'email') return vendor.user?.email;
    return vendor[k];
  };
  const live: Record<string, unknown> = Object.fromEntries(
    Object.keys(VENDOR_LABELS).map((k) => [k, current(k)]),
  );
  const multiple = requests.length > 1;

  return (
    <div className="card overflow-hidden">
      {/* Summary banner — makes it obvious there are N pending updates awaiting a
          single decision. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-semibold text-white">
          {requests.length} Pending Change{requests.length === 1 ? '' : 's'}
        </span>
        <span className="text-amber-800 dark:text-amber-200">
          Requested by <span className="font-medium">{vendor.businessName ?? vendor.user?.fullName ?? 'this vendor'}</span>
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Awaiting review
        </span>
      </div>

      {requests.map((req, i) => {
        const prev = i === 0 ? live : requests[i - 1].data;
        const rows = diffObjects(prev, req.data, VENDOR_LABELS);
        return (
          <ChangeTable
            key={i}
            rows={rows}
            title={multiple ? `Change request #${i + 1}` : 'Requested profile changes, review before approving'}
            submittedAt={req.submittedAt || vendor.updatedAt}
            formatValue={fmt}
          />
        );
      })}

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        {rejecting ? (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">
              Reason for rejecting these changes (optional, shown to the vendor)
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
                {reject.isPending ? 'Rejecting…' : 'Confirm Reject All'}
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
              <CheckCircle2 className="h-3.5 w-3.5" /> {approve.isPending ? 'Approving…' : 'Approve All Changes'}
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
