import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox, ChevronDown, ChevronUp, UserPlus, XCircle, CheckCircle2,
  Mail, Phone, MapPin, Building2, User, Hash, Clock, FileText, Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const STATUS_CLS: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

type Lead = {
  id: string; leadType?: string; serviceCategory?: string | null;
  businessName: string; fullName: string; email: string; phone: string;
  city: string; slotsApprox?: number | null; notes?: string | null; status: string;
  createdAt: string; reviewedAt?: string | null;
};

/**
 * Partner submissions from the customer site, filtered by lead type:
 *  - PARKING → "List your space" (convert into a vendor)
 *  - SERVICE → "Become a partner" auto-service requests (approve / reject)
 */
export const ListingRequests = ({ leadType }: { leadType: 'PARKING' | 'SERVICE' }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const isService = leadType === 'SERVICE';

  const makeVendor = (lead: Lead) => {
    const q = new URLSearchParams({
      leadId: lead.id,
      businessName: lead.businessName,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
    });
    navigate(`/vendors/add?${q.toString()}`);
  };

  const { data } = useQuery({
    queryKey: ['vendor-leads', leadType, showAll ? 'ALL' : 'PENDING'],
    queryFn: async () =>
      (await api.get('/admin/vendor-leads', {
        params: { type: leadType, ...(showAll ? {} : { status: 'PENDING' }) },
      })).data,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.patch(`/admin/vendor-leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-leads'] }),
  });

  const leads: Lead[] = data?.items ?? [];
  const pendingCount = leads.filter((l) => l.status === 'PENDING').length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold">{isService ? 'Service Partner Requests' : 'Space Listing Requests'}</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {showAll ? 'Show pending only' : 'Show all'}
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">
          {isService ? 'No service requests.' : 'No listing requests.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {leads.map((lead) => {
            const open = openId === lead.id;
            return (
              <div key={lead.id}>
                {/* Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{lead.businessName}</span>
                      {isService && lead.serviceCategory && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                          <Wrench className="h-3 w-3" /> {lead.serviceCategory}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[lead.status] ?? ''}`}>
                        {lead.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lead.fullName} · {lead.city} · {fmtDate(lead.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenId(open ? null : lead.id)}
                    className="btn-ghost inline-flex items-center gap-1 text-xs"
                  >
                    {open ? <>Hide <ChevronUp className="h-3.5 w-3.5" /></> : <>View details <ChevronDown className="h-3.5 w-3.5" /></>}
                  </button>
                </div>

                {/* Details */}
                {open && (
                  <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <Detail icon={<Building2 className="h-3.5 w-3.5" />} label="Business" value={lead.businessName} />
                      <Detail icon={<User className="h-3.5 w-3.5" />} label="Contact" value={lead.fullName} />
                      <Detail icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={<a href={`mailto:${lead.email}`} className="text-brand-600 underline dark:text-brand-400">{lead.email}</a>} />
                      <Detail icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={<a href={`tel:${lead.phone}`} className="text-brand-600 underline dark:text-brand-400">{lead.phone}</a>} />
                      <Detail icon={<MapPin className="h-3.5 w-3.5" />} label="City" value={lead.city} />
                      {isService ? (
                        <Detail icon={<Wrench className="h-3.5 w-3.5" />} label="Service" value={lead.serviceCategory ?? '-'} />
                      ) : (
                        <Detail icon={<Hash className="h-3.5 w-3.5" />} label="Approx. slots" value={lead.slotsApprox != null ? String(lead.slotsApprox) : '-'} />
                      )}
                      <Detail icon={<Clock className="h-3.5 w-3.5" />} label="Submitted" value={fmtDate(lead.createdAt)} />
                      {lead.reviewedAt && <Detail icon={<Clock className="h-3.5 w-3.5" />} label="Reviewed" value={fmtDate(lead.reviewedAt)} />}
                      {lead.notes && <Detail icon={<FileText className="h-3.5 w-3.5" />} label="Notes" value={lead.notes} full />}
                    </dl>

                    {lead.status === 'PENDING' && (
                      <div className="flex flex-wrap gap-2">
                        {isService ? (
                          <button
                            onClick={() => setStatus.mutate({ id: lead.id, status: 'APPROVED' })}
                            disabled={setStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => makeVendor(lead)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Make as Vendor
                          </button>
                        )}
                        <button
                          onClick={() => setStatus.mutate({ id: lead.id, status: 'REJECTED' })}
                          disabled={setStatus.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/50 dark:hover:bg-red-900/20"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                    {lead.status === 'APPROVED' && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {isService ? '✓ Approved.' : '✓ Converted to vendor.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Detail = ({
  icon, label, value, full,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; full?: boolean }) => (
  <div className={full ? 'sm:col-span-2' : ''}>
    <dt className="mb-0.5 flex items-center gap-1.5 text-xs text-slate-400">{icon} {label}</dt>
    <dd className="break-words text-slate-700 dark:text-slate-200">{value}</dd>
  </div>
);
