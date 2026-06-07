import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, User, Phone, Mail, MapPin,
  Lock, CheckCircle2, Eye, EyeOff, ShieldCheck, UploadCloud, FileText, X,
} from 'lucide-react';
import { api } from '@/lib/api';

interface VendorForm {
  businessName: string;
  contactPhone: string;
  address: string;
  fullName: string;
  email: string;
  phone: string;
  aadharNumber: string;
  tempPassword: string;
}

const EMPTY: VendorForm = {
  businessName: '',
  contactPhone: '',
  address: '',
  fullName: '',
  email: '',
  phone: '',
  aadharNumber: '',
  tempPassword: '',
};

// ── Field component ────────────────────────────────────────────────────────────
const Field = ({
  label, required, hint, error, children,
}: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
    {hint  && !error && <p className="text-xs text-slate-400">{hint}</p>}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// ── Section wrapper ────────────────────────────────────────────────────────────
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
    <div className="space-y-4">{children}</div>
  </div>
);

// ── Aadhar doc picker ──────────────────────────────────────────────────────────
const DocPicker = ({
  file, uploading, url, onFile, onClear,
}: {
  file: File | null; uploading: boolean; url: string | null;
  onFile: (f: File) => void; onClear: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  const isPdf = file?.type === 'application/pdf' || url?.endsWith('.pdf');

  if (url) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/20">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
          {isPdf
            ? <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {file ? file.name : 'Document uploaded'}
          </p>
          <a href={url} target="_blank" rel="noreferrer"
            className="text-xs text-emerald-600 underline dark:text-emerald-400">
            View document
          </a>
        </div>
        <button type="button" onClick={onClear}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition
        ${uploading ? 'pointer-events-none opacity-60' : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'}`}
    >
      <UploadCloud className="mb-2 h-6 w-6 text-slate-400" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {uploading ? 'Uploading…' : 'Click to upload Aadhar document'}
      </p>
      <p className="mt-1 text-xs text-slate-400">JPEG, PNG, WebP or PDF · max 10 MB</p>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const AddVendorPage = () => {
  const navigate = useNavigate();
  const [form, setForm]         = useState<VendorForm>(EMPTY);
  const [showPwd, setShowPwd]   = useState(false);
  const [errors, setErrors]     = useState<Partial<Record<keyof VendorForm, string>>>({});
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [aadharDocUrl, setAadharDocUrl] = useState<string | null>(null);
  const [uploadErr, setUploadErr]   = useState('');

  const set = (key: keyof VendorForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((err) => ({ ...err, [key]: undefined }));
    };

  // Phone fields: digits only, capped at 10.
  const setPhone = (key: keyof VendorForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, 10) }));
      setErrors((err) => ({ ...err, [key]: undefined }));
    };

  // ── Upload doc mutation ────────────────────────────────────────────────────
  const uploadDoc = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<{ url: string }>('/uploads/documents', fd).then((r) => r.data.url);
    },
    onSuccess: (url) => { setAadharDocUrl(url); setUploadErr(''); },
    onError: () => setUploadErr('Upload failed. Please try again.'),
  });

  const handleFile = (file: File) => {
    setAadharFile(file);
    setAadharDocUrl(null);
    uploadDoc.mutate(file);
  };

  const clearDoc = () => {
    setAadharFile(null);
    setAadharDocUrl(null);
    setUploadErr('');
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Partial<Record<keyof VendorForm, string>> = {};
    if (!form.businessName.trim())                e.businessName = 'Business name is required';
    if (!form.contactPhone.trim())                e.contactPhone = 'Contact phone is required';
    else if (form.contactPhone.trim().length < 7) e.contactPhone = 'Must be at least 7 digits';
    if (!form.address.trim())                     e.address      = 'Address is required';
    if (!form.fullName.trim())                    e.fullName     = 'Owner name is required';
    if (!form.email.trim())                       e.email        = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.tempPassword)                       e.tempPassword = 'Password is required';
    else if (form.tempPassword.length < 8)        e.tempPassword = 'Must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Create mutation ────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: (body: VendorForm & { aadharDocUrl?: string }) =>
      api.post('/admin/vendors', {
        businessName: body.businessName.trim(),
        contactPhone: body.contactPhone.trim(),
        address:      body.address.trim(),
        fullName:     body.fullName.trim(),
        email:        body.email.trim(),
        phone:        body.phone.trim() || undefined,
        aadharNumber: body.aadharNumber.trim() || undefined,
        aadharDocUrl: body.aadharDocUrl || undefined,
        tempPassword: body.tempPassword,
      }),
    onSuccess: () => { setTimeout(() => navigate('/vendors'), 1500); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (aadharFile && !aadharDocUrl) { setUploadErr('Please wait for the document to finish uploading.'); return; }
    create.mutate({ ...form, aadharDocUrl: aadharDocUrl ?? undefined });
  };

  return (
    <section className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/vendors')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Add Vendor</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create a vendor account directly — it will be marked as approved immediately.
          </p>
        </div>
      </div>

      {/* Success */}
      {create.isSuccess && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Vendor created successfully!</p>
            <p className="text-xs opacity-75">Redirecting to vendors list…</p>
          </div>
        </div>
      )}

      {/* API error */}
      {create.isError && (
        <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {(create.error as any)?.response?.data?.message ?? (create.error as Error).message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Business Details ── */}
        <Section icon={Building2} title="Business Details">
          <Field label="Business Name" required error={errors.businessName}>
            <input
              className={`input w-full ${errors.businessName ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="e.g. City Park Pvt. Ltd."
              value={form.businessName}
              onChange={set('businessName')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business Contact Phone" required error={errors.contactPhone}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className={`input w-full pl-9 ${errors.contactPhone ? 'border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="10-digit mobile"
                  value={form.contactPhone}
                  onChange={setPhone('contactPhone')}
                />
              </div>
            </Field>

            <Field label="Business Address" required error={errors.address}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`input w-full pl-9 ${errors.address ? 'border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="Business address"
                  value={form.address}
                  onChange={set('address')}
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── Owner / Login Account ── */}
        <Section icon={User} title="Owner Account">
          <p className="text-xs text-slate-500">These details create the login account for the vendor.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required error={errors.fullName}>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={`input w-full pl-9 ${errors.fullName ? 'border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="Owner's full name"
                  value={form.fullName}
                  onChange={set('fullName')}
                />
              </div>
            </Field>

            <Field label="Personal Phone" hint="Optional — personal contact number">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="input w-full pl-9"
                  placeholder="Personal phone (optional)"
                  value={form.phone}
                  onChange={setPhone('phone')}
                />
              </div>
            </Field>
          </div>

          <Field label="Email" required hint="Used to log in to the vendor portal" error={errors.email}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                className={`input w-full pl-9 ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="vendor@example.com"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </Field>

          <Field
            label="Temporary Password"
            required
            hint="Share this with the vendor — they should change it on first login"
            error={errors.tempPassword}
          >
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                className={`input w-full pl-9 pr-10 ${errors.tempPassword ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Min. 8 characters"
                value={form.tempPassword}
                onChange={set('tempPassword')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </Section>

        {/* ── KYC / Aadhar ── */}
        <Section icon={ShieldCheck} title="KYC Details">
          <Field label="Aadhar Card Number" hint="12-digit Aadhar number (optional)">
            <input
              className="input w-full"
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
              value={form.aadharNumber}
              onChange={set('aadharNumber')}
            />
          </Field>

          <Field label="Aadhar Card Document" hint="Upload a photo or PDF of the Aadhar card (optional)">
            <DocPicker
              file={aadharFile}
              uploading={uploadDoc.isPending}
              url={aadharDocUrl}
              onFile={handleFile}
              onClear={clearDoc}
            />
            {uploadErr && <p className="mt-1 text-xs text-red-500">{uploadErr}</p>}
          </Field>
        </Section>

        {/* ── Submit ── */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/vendors')}
            className="btn-ghost flex-1"
            disabled={create.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={create.isPending || create.isSuccess || uploadDoc.isPending}
          >
            {create.isPending ? 'Creating Vendor…' : 'Create Vendor'}
          </button>
        </div>
      </form>
    </section>
  );
};
