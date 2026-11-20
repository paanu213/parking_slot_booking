import { useQuery } from '@tanstack/react-query';
import { ArrowRight, History } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/qrCallingFormat';

interface HistoryEntry {
  id: string;
  at: string;
  scope: 'vehicle' | 'account';
  by: { name: string; email: string; role: string; isCustomer: boolean } | null;
  changes: { field: string; label: string; from: string | null; to: string | null }[];
}

const shown = (v: string | null) => (v && v.trim() ? v : 'empty');

/**
 * Who changed the contact number, owner name, plate or account details of a
 * registered vehicle, when, and the old and new values. Admin only.
 */
export const VehicleChangeHistory = ({ vehicleId, compact }: { vehicleId: string; compact?: boolean }) => {
  const { data, isLoading } = useQuery<{ items: HistoryEntry[] }>({
    queryKey: ['admin-qr-vehicle-history', vehicleId],
    queryFn: async () => (await api.get(`/admin/qr/vehicles/${vehicleId}/history`)).data,
  });
  const items = data?.items ?? [];

  return (
    <div>
      <h3 className={cn('flex items-center gap-1.5 font-semibold', compact ? 'text-sm' : 'text-xs uppercase tracking-wide text-slate-400')}>
        <History className="h-3.5 w-3.5" /> Change history
      </h3>
      {isLoading ? (
        <p className="mt-2 text-xs text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No changes recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((h) => (
            <li key={h.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {h.by ? (
                    <>
                      <b className="text-slate-700 dark:text-slate-200">{h.by.isCustomer ? 'Customer' : h.by.name}</b>
                      {!h.by.isCustomer && <span> (admin)</span>} · {h.by.email}
                    </>
                  ) : 'Unknown'}
                </span>
                <span>{fmtDateTime(h.at)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {h.changes.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{c.label}:</span>
                    <span className="font-mono text-slate-500 line-through decoration-slate-300">{shown(c.from)}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="font-mono font-semibold">{shown(c.to)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
