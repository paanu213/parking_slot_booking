import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, User, ShieldCheck, FileText,
  CreditCard, UploadCloud, CheckCircle2, AlertCircle, X, Edit2, Save, Plus,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VendorProfile {
  id: string;
  businessName: string;
  contactPhone: string;
  address: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  payoutUpiId?: string | null;
  aadharNumber?: string | null;
  aadharDocUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
  rejectionNote?: string | null;
  pendingProfileData?: string | null;
  user: {
    fullName: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
}

interface EditForm {
  // Owner / User fields
  fullName: string;
  phone: string;
  email: string;
  // Business fields
  businessName: string;
  contactPhone: string;
  address: string;
  // Financial fields
  gstNumber: string;
  panNumber: string;
  payoutUpiId: string;
  // KYC fields
  aadharNumber: string;
  aadharDocUrl: string;
}

// ── Field row (read-only display) ────────────────────────────────────────────
const InfoRow = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
  value ? (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="w-36 shrink-0 text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-medium text-slate-800 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null
);

// ── Section card ──────────────────────────────────────────────────────────────
const Section = ({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode;
}) => (
  <div className="card p-5">
    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
      <Icon className="h-4 w-4 text-brand-500" />
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// ── Doc upload picker ─────────────────────────────────────────────────────────
const DocPicker = ({
  currentUrl, uploading, onUploaded,
}: {
  currentUrl: string; uploading: boolean; onUploaded: (url: string) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const isPdf = currentUrl?.endsWith('.pdf');

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          {isPdf
            ? <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          <a href={currentUrl} target="_blank" rel="noreferrer"
            className="flex-1 truncate text-xs text-emerald-700 underline dark:text-emerald-300">
            View current document
          </a>
          <button type="button" onClick={() => ref.current?.click()}
            className="shrink-0 text-xs text-brand-600 underline dark:text-brand-400">
            Replace
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && ref.current?.click()}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5 transition
            ${uploading ? 'pointer-events-none opacity-60' : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'}`}
        >
          <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-xs text-slate-500">
            {uploading ? 'Uploading…' : 'Upload Aadhar (image or PDF · max 10 MB)'}
          </span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append('file', f);
          api.post<{ url: string }>('/uploads/documents', fd).then((r) => onUploaded(r.data.url));
        } e.target.value = ''; }} />
    </div>
  );
};

// ── Inline KYC doc picker (used inside the read-only add panel) ───────────────
const KycDocPicker = ({
  url, uploading, onUploading, onUploaded, onClear,
}: {
  url: string; uploading: boolean;
  onUploading: (v: boolean) => void;
  onUploaded:  (url: string) => void;
  onClear:     () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const isPdf = url?.endsWith('.pdf');

  const handleFile = (file: File) => {
    onUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    api.post<{ url: string }>('/uploads/documents', fd)
      .then((r) => onUploaded(r.data.url))
      .catch(() => { onUploading(false); });
  };

  return (
    <div className="space-y-1.5">
      {url ? (
        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <div className="flex items-center gap-3 px-3 py-2.5">
            {isPdf
              ? <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            <a href={url} target="_blank" rel="noreferrer"
              className="flex-1 truncate text-xs text-emerald-700 underline dark:text-emerald-300">
              View uploaded document
            </a>
            <button type="button" onClick={onClear}
              className="shrink-0 text-slate-400 hover:text-red-500 transition" title="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="border-t border-emerald-200 px-3 py-2 dark:border-emerald-800/40">
            <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 transition">
              <UploadCloud className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : 'Replace with a new document'}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && ref.current?.click()}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-2.5 transition
            ${uploading ? 'pointer-events-none opacity-60' : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'}`}
        >
          <UploadCloud className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-xs text-slate-500">
            {uploading ? 'Uploading…' : 'Upload Aadhar (image or PDF · max 10 MB)'}
          </span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const ProfilePage = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<EditForm>({
    fullName: '', phone: '', email: '',
    businessName: '', contactPhone: '', address: '',
    gstNumber: '', panNumber: '', payoutUpiId: '',
    aadharNumber: '', aadharDocUrl: '',
  });
  const [docUploading, setDocUploading] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Inline KYC add (shown in read-only view when no KYC data exists)
  const [kycOpen,         setKycOpen]         = useState(false);
  const [kycNumber,       setKycNumber]       = useState('');
  const [kycDocUrl,       setKycDocUrl]       = useState('');
  const [kycDocUploading, setKycDocUploading] = useState(false);
  const [kycErr,          setKycErr]          = useState('');

  const { data: profile, isLoading } = useQuery<VendorProfile>({
    queryKey: ['vendor-me'],
    queryFn: async () => (await api.get('/vendor/me')).data,
  });

  // When edit mode opens, pre-fill the form with current values
  useEffect(() => {
    if (editing && profile) {
      setForm({
        fullName:     profile.user.fullName  ?? '',
        phone:        profile.user.phone     ?? '',
        email:        profile.user.email     ?? '',
        businessName: profile.businessName   ?? '',
        contactPhone: profile.contactPhone   ?? '',
        address:      profile.address        ?? '',
        gstNumber:    profile.gstNumber      ?? '',
        panNumber:    profile.panNumber      ?? '',
        payoutUpiId:  profile.payoutUpiId    ?? '',
        aadharNumber: profile.aadharNumber   ?? '',
        aadharDocUrl: profile.aadharDocUrl   ?? '',
      });
      setFormErr('');
    }
  }, [editing, profile]);

  const save = useMutation({
    mutationFn: (v: EditForm) =>
      api.put('/vendor/me', {
        fullName:     v.fullName.trim()     || undefined,
        phone:        v.phone.trim()        || undefined,
        email:        v.email.trim()        || undefined,
        businessName: v.businessName.trim() || undefined,
        contactPhone: v.contactPhone.trim() || undefined,
        address:      v.address.trim()      || undefined,
        gstNumber:    v.gstNumber.trim()    || undefined,
        panNumber:    v.panNumber.trim()    || undefined,
        payoutUpiId:  v.payoutUpiId.trim()  || undefined,
        aadharNumber: v.aadharNumber.trim() || undefined,
        aadharDocUrl: v.aadharDocUrl.trim() || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      setEditing(false);
    },
    onError: (e: any) => setFormErr(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Failed to save. Please try again.'),
  });

  // Inline KYC save mutation
  const saveKyc = useMutation({
    mutationFn: () =>
      api.put('/vendor/me', {
        aadharNumber: kycNumber.trim() || undefined,
        aadharDocUrl: kycDocUrl.trim() || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
      setKycOpen(false);
      setKycNumber('');
      setKycDocUrl('');
      setKycErr('');
    },
    onError: (e: any) => setKycErr(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Failed to save. Please try again.'),
  });

  const set = (key: keyof EditForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Phone fields: digits only, capped at 10.
  const setPhone = (key: keyof EditForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, 10) }));

  if (isLoading) {
    return (
      <section className="p-6">
        <div className="space-y-4 max-w-2xl">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      </section>
    );
  }

  if (!profile) return null;

  const isApproved     = profile.status === 'APPROVED';
  const hasPending     = Boolean(profile.pendingProfileData);
  const pendingData    = hasPending ? (JSON.parse(profile.pendingProfileData!) as Record<string, string>) : null;
  const canEdit        = isApproved;
  const hasApprovedKyc = Boolean(profile.aadharNumber || profile.aadharDocUrl);
  // pendingData may only contain KYC fields (from inline KYC form) or all profile fields (from full edit)
  const pendingKyc     = Boolean(pendingData && (pendingData.aadharNumber || pendingData.aadharDocUrl));

  return (
    <section className="mx-auto max-w-2xl p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Profile</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isApproved ? 'Your account is live.' : `Status: ${profile.status}`}
          </p>
        </div>
        {canEdit && !editing && !hasPending && (
          <button
            onClick={() => setEditing(true)}
            className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          >
            <Edit2 className="h-4 w-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* ── Rejection note ── */}
      {profile.status === 'REJECTED' && profile.rejectionNote && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          <p className="font-semibold">Account Rejected</p>
          <p className="mt-0.5 text-xs opacity-90">{profile.rejectionNote}</p>
        </div>
      )}

      {/* ── Pending profile edit banner ── */}
      {hasPending && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/50 dark:bg-blue-900/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Profile edit awaiting admin approval</p>
              <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
                Your changes are under review. The values shown below reflect your currently approved profile.
                You cannot submit new edits until this review is complete.
              </p>
            </div>
          </div>
          {/* Show what's pending */}
          {pendingData && (
            <div className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {[
                ['Full Name',      'fullName'],
                ['Personal Phone', 'phone'],
                ['Email',          'email'],
                ['Business Name',  'businessName'],
                ['Contact Phone',  'contactPhone'],
                ['Address',        'address'],
                ['GST Number',     'gstNumber'],
                ['PAN Number',     'panNumber'],
                ['Payout UPI ID',  'payoutUpiId'],
                ['Aadhar Number',  'aadharNumber'],
              ].map(([label, key]) =>
                pendingData[key] ? (
                  <div key={key} className="flex gap-1.5">
                    <span className="w-28 shrink-0 text-blue-400">{label}:</span>
                    <span className="font-medium text-blue-700 dark:text-blue-200 break-all">{pendingData[key]}</span>
                  </div>
                ) : null,
              )}
              {pendingData.aadharDocUrl && (
                <div className="flex gap-1.5">
                  <span className="w-28 shrink-0 text-blue-400">Aadhar Doc:</span>
                  <a href={pendingData.aadharDocUrl} target="_blank" rel="noreferrer"
                    className="font-medium text-blue-600 underline dark:text-blue-300">View</a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {editing ? (
        <div className="space-y-5">

          {/* Owner / Account */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <User className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold">Owner Account</h2>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                  <input className="input w-full" placeholder="Owner's full name" value={form.fullName} onChange={set('fullName')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Personal Phone</label>
                  <input className="input w-full" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.phone} onChange={setPhone('phone')} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                <input className="input w-full" type="email" placeholder="Login email" value={form.email} onChange={set('email')} />
              </div>
            </div>
          </div>

          {/* Business */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Building2 className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold">Business Details</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Business Name</label>
                <input className="input w-full" value={form.businessName} onChange={set('businessName')} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Business Contact Phone</label>
                  <input className="input w-full" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.contactPhone} onChange={setPhone('contactPhone')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Address</label>
                  <input className="input w-full" value={form.address} onChange={set('address')} />
                </div>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <CreditCard className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold">Financial Details</h2>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">GST Number</label>
                  <input className="input w-full" placeholder="Optional" value={form.gstNumber} onChange={set('gstNumber')} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">PAN Number</label>
                  <input className="input w-full" placeholder="Optional" value={form.panNumber} onChange={set('panNumber')} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Payout UPI ID</label>
                <input className="input w-full" placeholder="name@bank (optional)" value={form.payoutUpiId} onChange={set('payoutUpiId')} />
              </div>
            </div>
          </div>

          {/* KYC */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <ShieldCheck className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold">KYC Details</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Aadhar Card Number</label>
                <input className="input w-full" placeholder="XXXX XXXX XXXX (optional)" maxLength={14}
                  value={form.aadharNumber} onChange={set('aadharNumber')} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Aadhar Card Document</label>
                <DocPicker
                  currentUrl={form.aadharDocUrl}
                  uploading={docUploading}
                  onUploaded={(url) => { setForm((f) => ({ ...f, aadharDocUrl: url })); setDocUploading(false); }}
                />
              </div>
            </div>
          </div>

          {formErr && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {formErr}
            </p>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
            ℹ️ Since your account is approved, edits will go to admin for review before taking effect.
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1" disabled={save.isPending}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={save.isPending || docUploading}
              onClick={() => save.mutate(form)}
            >
              {save.isPending ? 'Submitting…' : <><Save className="mr-1.5 h-4 w-4" /> Submit for Review</>}
            </button>
          </div>
        </div>
      ) : (
        /* ── READ-ONLY VIEW ── */
        <div className="space-y-5">
          {/* Owner info */}
          <Section icon={User} title="Owner / Account">
            <InfoRow label="Full Name"     value={profile.user.fullName} />
            <InfoRow label="Email"         value={profile.user.email} />
            <InfoRow label="Personal Phone" value={profile.user.phone} />
          </Section>

          {/* Business info */}
          <Section icon={Building2} title="Business Details">
            <InfoRow label="Business Name"   value={profile.businessName} />
            <InfoRow label="Contact Phone"   value={profile.contactPhone} />
            <InfoRow label="Address"         value={profile.address} />
          </Section>

          {/* Financial info */}
          <Section icon={CreditCard} title="Financial Details">
            <InfoRow label="GST Number"    value={profile.gstNumber}    mono />
            <InfoRow label="PAN Number"    value={profile.panNumber}    mono />
            <InfoRow label="Payout UPI ID" value={profile.payoutUpiId} mono />
            {!profile.gstNumber && !profile.panNumber && !profile.payoutUpiId && (
              <p className="text-xs text-slate-400">No financial details added yet.</p>
            )}
          </Section>

          {/* KYC */}
          <div className="card overflow-hidden p-0">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold">KYC Details</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* "Add KYC" — shown when no approved KYC, no pending KYC, not already open */}
                {canEdit && !hasApprovedKyc && !pendingKyc && !kycOpen && (
                  <button
                    onClick={() => { setKycOpen(true); setKycNumber(''); setKycDocUrl(''); setKycErr(''); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add KYC
                  </button>
                )}
                {/* "Modify" — shown when KYC is pending review and form is closed */}
                {canEdit && pendingKyc && !kycOpen && (
                  <button
                    onClick={() => {
                      setKycNumber(pendingData?.aadharNumber ?? '');
                      setKycDocUrl(pendingData?.aadharDocUrl ?? '');
                      setKycErr('');
                      setKycOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 transition"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Modify
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 p-5">

              {/* ── Approved KYC — read-only ── */}
              {hasApprovedKyc && (
                <>
                  {profile.aadharNumber && (
                    <InfoRow label="Aadhar Number" value={profile.aadharNumber} mono />
                  )}
                  {profile.aadharDocUrl && (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                      <span className="w-36 shrink-0 text-xs text-slate-400">Aadhar Document</span>
                      <a href={profile.aadharDocUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 underline dark:text-brand-400">
                        {profile.aadharDocUrl.endsWith('.pdf')
                          ? <><FileText className="h-3.5 w-3.5" /> View PDF</>
                          : <><CheckCircle2 className="h-3.5 w-3.5" /> View Image</>}
                      </a>
                    </div>
                  )}
                </>
              )}

              {/* ── Pending KYC — under review banner ── */}
              {pendingKyc && !kycOpen && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
                  {/* Status row */}
                  <div className="mb-3 flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        KYC details are being reviewed by admin
                      </p>
                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        Please wait — this usually takes 1–2 business days. You can modify your submission while it's under review.
                      </p>
                    </div>
                  </div>
                  {/* Submitted values preview */}
                  <div className="space-y-1.5 rounded-lg border border-amber-200 bg-white/60 px-3 py-2.5 text-xs dark:border-amber-800/30 dark:bg-black/20">
                    <p className="mb-1.5 font-medium text-amber-700 dark:text-amber-400">Submitted details:</p>
                    {pendingData?.aadharNumber && (
                      <div className="flex gap-2">
                        <span className="w-28 shrink-0 text-slate-400">Aadhar Number</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{pendingData.aadharNumber}</span>
                      </div>
                    )}
                    {pendingData?.aadharDocUrl && (
                      <div className="flex gap-2">
                        <span className="w-28 shrink-0 text-slate-400">Document</span>
                        <a href={pendingData.aadharDocUrl} target="_blank" rel="noreferrer"
                          className="font-medium text-brand-600 underline dark:text-brand-400">
                          {pendingData.aadharDocUrl.endsWith('.pdf') ? 'View PDF' : 'View Image'}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── No KYC at all — empty state ── */}
              {!hasApprovedKyc && !pendingKyc && !kycOpen && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <ShieldCheck className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm font-medium text-slate-400">No KYC documents on record</p>
                  {canEdit
                    ? <p className="text-xs text-slate-400">Click <strong>Add KYC</strong> above to submit your Aadhar details.</p>
                    : <p className="text-xs text-slate-400">KYC details can be added once your account is approved.</p>
                  }
                </div>
              )}

              {/* ── Inline KYC form (add / modify) ── */}
              {kycOpen && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="text-xs font-semibold text-slate-500">
                    {pendingKyc ? 'Modify KYC Submission' : 'Add Aadhar Details'}
                  </p>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Aadhar Card Number</label>
                    <input
                      className="input w-full"
                      placeholder="XXXX XXXX XXXX"
                      maxLength={14}
                      value={kycNumber}
                      onChange={(e) => { setKycNumber(e.target.value); setKycErr(''); }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      Aadhar Document <span className="text-slate-400">(image or PDF)</span>
                    </label>
                    <KycDocPicker
                      url={kycDocUrl}
                      uploading={kycDocUploading}
                      onUploading={setKycDocUploading}
                      onUploaded={(url) => { setKycDocUrl(url); setKycDocUploading(false); setKycErr(''); }}
                      onClear={() => setKycDocUrl('')}
                    />
                  </div>

                  {kycErr && <p className="text-xs text-red-500">{kycErr}</p>}

                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                    ℹ️ {pendingKyc
                      ? 'This will replace your existing pending submission and go to admin for review.'
                      : 'Since your account is approved, this submission will go to admin for review.'}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setKycOpen(false); setKycNumber(''); setKycDocUrl(''); setKycErr(''); }}
                      className="btn-ghost flex-1 text-sm"
                      disabled={saveKyc.isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saveKyc.isPending || kycDocUploading || (!kycNumber.trim() && !kycDocUrl)}
                      onClick={() => {
                        if (!kycNumber.trim() && !kycDocUrl) {
                          setKycErr('Please enter an Aadhar number or upload a document.');
                          return;
                        }
                        saveKyc.mutate();
                      }}
                      className="btn-primary flex-1 text-sm"
                    >
                      {saveKyc.isPending
                        ? 'Submitting…'
                        : pendingKyc ? 'Update Submission' : 'Submit for Review'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edit hint for non-approved vendors */}
          {!canEdit && (
            <p className="text-center text-xs text-slate-400">
              Profile editing is available once your account is approved by admin.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
