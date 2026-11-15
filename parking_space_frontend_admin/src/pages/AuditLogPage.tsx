import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, History, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface AuditLogRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
}

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Turns "QR_VEHICLE_PAUSE" into "Qr vehicle pause" for a friendlier read; the raw value still shows below. */
const humanizeAction = (action: string) =>
  action.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Every admin action across the app writes a row to AuditLog (vendor
 * approvals, refunds, QR vehicle reassign/pause/contact edits, commission
 * rate changes, etc. — see prisma.auditLog.create() calls throughout
 * admin.service.ts). This is the one place to read them back.
 */
export const AuditLogPage = () => {
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [entity, setEntity] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: entities } = useQuery<{ items: string[] }>({
    queryKey: ['admin-audit-entities'],
    queryFn: async () => (await api.get('/admin/audit-logs/entities')).data,
  });

  const { data, isLoading } = useQuery<{ items: AuditLogRow[] }>({
    queryKey: ['admin-audit-logs', q, entity],
    queryFn: async () => (await api.get('/admin/audit-logs', { params: { q: q || undefined, entity: entity || undefined } })).data,
  });
  const items = data?.items ?? [];

  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <History className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-slate-500">Every admin action, who did it, and when — most recent 300.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); }} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search actor, action, entity id…"
              className="input w-72 pl-9"
            />
          </div>
          <button type="submit" className="btn-ghost text-sm">Search</button>
          {q && <button type="button" onClick={() => { setQ(''); setQInput(''); }} className="text-xs font-semibold text-slate-500 hover:underline">Clear</button>}
        </form>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input w-48">
          <option value="">All entities</option>
          {(entities?.items ?? []).map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th /></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-400">No matching audit log entries.</td></tr>
            ) : (
              items.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(r.createdAt)}</td>
                      <td>
                        {r.actor ? (
                          <>
                            <p className="font-medium">{r.actor.fullName}</p>
                            <p className="text-xs text-slate-400">{r.actor.email}</p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">System</span>
                        )}
                      </td>
                      <td>
                        <p className="font-medium">{humanizeAction(r.action)}</p>
                        <p className="font-mono text-[11px] text-slate-400">{r.action}</p>
                      </td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {r.entity}
                        </span>
                        {r.entityId && <p className="mt-0.5 font-mono text-[11px] text-slate-400">{r.entityId}</p>}
                      </td>
                      <td className="text-right">
                        {r.metadata && (
                          <ChevronDown className={cn('ml-auto h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
                        )}
                      </td>
                    </tr>
                    {isOpen && r.metadata && (
                      <tr className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={5} className="px-3 py-3">
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-600 dark:text-slate-300">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(r.metadata!), null, 2); }
                              catch { return r.metadata; }
                            })()}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
