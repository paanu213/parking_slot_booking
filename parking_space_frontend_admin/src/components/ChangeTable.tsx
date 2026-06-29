import { Pencil, PlusCircle, MinusCircle } from 'lucide-react';

/**
 * Shared current-vs-requested change view, used for both space edits
 * (pendingData) and vendor profile edits (pendingProfileData).
 */
type Kind = 'added' | 'removed' | 'updated';
export type ChangeRow = { key: string; label: string; current: unknown; requested: unknown; kind: Kind };

const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** Build the list of changed fields from a pending-JSON blob + a current-value resolver. */
export const computeChanges = (
  pendingJson: string | null | undefined,
  current: (key: string) => unknown,
  labels: Record<string, string>,
): ChangeRow[] => {
  if (!pendingJson) return [];
  let pending: Record<string, unknown>;
  try { pending = JSON.parse(pendingJson); } catch { return []; }
  return Object.keys(pending)
    .filter((k) => norm(current(k)) !== norm(pending[k]))
    .map((k) => {
      const cur = current(k);
      const req = pending[k];
      const kind: Kind = norm(cur) === '' ? 'added' : norm(req) === '' ? 'removed' : 'updated';
      return { key: k, label: labels[k] ?? k, current: cur, requested: req, kind };
    });
};

/** Diff two field snapshots (prev → next), returning only the changed fields. */
export const diffObjects = (
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  labels: Record<string, string>,
): ChangeRow[] =>
  Object.keys(next)
    .filter((k) => k in labels && norm(prev[k]) !== norm(next[k]))
    .map((k) => {
      const cur = prev[k];
      const req = next[k];
      const kind: Kind = norm(cur) === '' ? 'added' : norm(req) === '' ? 'removed' : 'updated';
      return { key: k, label: labels[k] ?? k, current: cur, requested: req, kind };
    });

export const ChangeTable = ({
  rows,
  title,
  submittedAt,
  footerNote,
  formatValue,
}: {
  rows: ChangeRow[];
  title: string;
  submittedAt?: string | null;
  footerNote?: string;
  /** Optional per-field display override (return undefined to fall back to default). */
  formatValue?: (key: string, value: unknown) => string | undefined;
}) => {
  const show = (key: string, v: unknown) => {
    const f = formatValue?.(key, v);
    if (f !== undefined) return f;
    const s = norm(v);
    return s === '' ? '—' : s;
  };
  const submitted = submittedAt
    ? new Date(submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="border-t border-blue-200 bg-blue-50/60 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/10">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-blue-800 dark:text-blue-300">
        <span className="inline-flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {title} ({rows.length} field{rows.length === 1 ? '' : 's'})
        </span>
        {submitted && <span className="font-normal text-blue-700/70 dark:text-blue-300/70">· submitted {submitted}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Resubmitted with no field changes.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white dark:border-blue-900/40 dark:bg-slate-900">
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Current value</th>
                <th className="px-3 py-2">Requested value</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{r.label}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{show(r.key, r.current)}</td>
                  <td className="px-3 py-2 font-semibold text-blue-700 dark:text-blue-300">{show(r.key, r.requested)}</td>
                  <td className="px-3 py-2"><KindBadge kind={r.kind} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {footerNote && <p className="mt-2 text-[11px] text-slate-400">{footerNote}</p>}
    </div>
  );
};

const KINDS: Record<Kind, { label: string; cls: string; Icon: typeof Pencil }> = {
  added:   { label: 'Added',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', Icon: PlusCircle },
  removed: { label: 'Removed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', Icon: MinusCircle },
  updated: { label: 'Updated', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', Icon: Pencil },
};

const KindBadge = ({ kind }: { kind: Kind }) => {
  const m = KINDS[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>
      <m.Icon className="h-2.5 w-2.5" /> {m.label}
    </span>
  );
};
