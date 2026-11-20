import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Handshake,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';
import { cn } from '@/lib/cn';

// Service verticals a partner can register for. Keep in sync with the homepage
// "service partners" section.
export const SERVICE_CATEGORIES = [
  'Mechanic',
  'Car spare parts',
  'Car wash',
  'Used cars / bikes',
  'Wheel alignment & balancing',
  'Car dent / paint service',
  'Car towing service',
];

interface PartnerForm {
  serviceCategory: string;
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  notes?: string;
}

export const CITIES = ['Hyderabad', 'Vizag', 'Vijayawada', 'Rajahmundry', 'Bengaluru', 'Chennai'];

export const ServicePartnerPage = () => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PartnerForm>({ defaultValues: { city: '', serviceCategory: '' } });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const cityValue = watch('city');
  const categoryValue = watch('serviceCategory');

  const submit = useMutation({
    mutationFn: (data: PartnerForm) =>
      api.post('/util/vendor-leads', {
        leadType:        'SERVICE',
        serviceCategory: data.serviceCategory,
        businessName:    data.businessName.trim(),
        fullName:        data.fullName.trim(),
        email:           data.email.trim(),
        phone:           data.phone.trim(),
        city:            data.city,
        notes:           data.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      reset({ city: '', serviceCategory: '' });
    },
    onError: (e) => setSubmitError(errorMessage(e)),
  });

  const onSubmit = (data: PartnerForm) => {
    setSubmitError(null);
    submit.mutate(data);
  };

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800/60">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 [background:radial-gradient(700px_350px_at_15%_0%,rgba(255,255,255,0.4),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center text-white sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Partner with AutoSahay
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Grow your auto-service business with us
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            We're building a trusted network of on-demand car & bike services. Tell us what you
            offer and our team will get you onboarded.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        {submitted ? (
          <SuccessCard onReset={() => setSubmitted(false)} />
        ) : (
          <div className="card">
            <div className="rounded-t-2xl border-b border-slate-100 bg-brand-50/40 px-6 py-5 dark:border-slate-800 dark:bg-brand-500/5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
                <Handshake className="h-3.5 w-3.5" /> Partner form
              </p>
              <h2 className="mt-1 font-display text-xl font-bold">Register your service</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Pick your service category and share a few details, a team member will reach out
                within 24 hours.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
              {/* Service category */}
              <Field label="Which service do you offer?" error={errors.serviceCategory?.message}>
                <input
                  type="hidden"
                  {...register('serviceCategory', { required: 'Pick a service category' })}
                />
                <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  <Select
                    value={categoryValue ?? ''}
                    onChange={(v) => setValue('serviceCategory', v, { shouldValidate: true })}
                    options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                    placeholder="Select a service"
                    ariaLabel="Service category"
                    showPlaceholderInList={false}
                    leadingIcon={<Wrench className="h-4 w-4 text-slate-500" />}
                    triggerClassName="w-full py-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business / shop name" error={errors.businessName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.businessName && 'border-rose-500')}
                    placeholder="e.g. Sri Sai Car Care"
                    {...register('businessName', { required: 'Required', minLength: { value: 2, message: 'Too short' } })}
                  />
                </Field>
                <Field label="Your full name" error={errors.fullName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.fullName && 'border-rose-500')}
                    placeholder="Owner / point of contact"
                    {...register('fullName', { required: 'Required', minLength: { value: 2, message: 'Too short' } })}
                  />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={cn('input mt-1', errors.phone && 'border-rose-500')}
                    placeholder="10-digit mobile"
                    {...register('phone', {
                      required: 'Required',
                      minLength: { value: 10, message: 'Enter a 10-digit number' },
                      onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
                    })}
                  />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <input
                    type="email"
                    className={cn('input mt-1', errors.email && 'border-rose-500')}
                    placeholder="you@example.com"
                    {...register('email', {
                      required: 'Required',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                    })}
                  />
                </Field>
                <Field label="City" error={errors.city?.message}>
                  <input type="hidden" {...register('city', { required: 'Pick a city' })} />
                  <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                    <Select
                      value={cityValue ?? ''}
                      onChange={(v) => setValue('city', v, { shouldValidate: true })}
                      options={CITIES.map((c) => ({ value: c, label: c }))}
                      placeholder="Pick a city"
                      ariaLabel="City"
                      leadingIcon={<MapPin className="h-4 w-4 text-slate-500" />}
                      triggerClassName="w-full py-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Anything else we should know?" hint="Optional">
                <textarea
                  rows={3}
                  className="input mt-1"
                  placeholder="Services offered, working hours, locations covered, etc."
                  {...register('notes')}
                />
              </Field>

              {submitError && (
                <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center gap-2"
                disabled={isSubmitting || submit.isPending}
              >
                {submit.isPending ? 'Submitting…' : (<>Submit request <ArrowRight className="h-4 w-4" /></>)}
              </button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Prefer to talk?{' '}
                <a href={`tel:+91${SUPPORT_PHONE}`} className="font-semibold text-brand-600 hover:underline">
                  Call +91 {SUPPORT_PHONE_DISPLAY}
                </a>{' '}
                or{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-600 hover:underline">
                  email {SUPPORT_EMAIL}
                </a>.
              </p>
            </form>
          </div>
        )}
      </section>

      <Footer />
    </>
  );
};

// ── Local form helpers ──────────────────────────────────────────────────────
const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-baseline justify-between">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
    {children}
    {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
  </div>
);

const SuccessCard = ({ onReset }: { onReset: () => void }) => (
  <div className="card p-8 text-center">
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
      <CheckCircle2 className="h-7 w-7" />
    </span>
    <h2 className="mt-4 font-display text-2xl font-bold">Thanks, we'll be in touch</h2>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      Your details are with our partnerships team. Expect a call within 24 hours.
    </p>
    <div className="mx-auto mt-6 grid max-w-md gap-2 sm:grid-cols-2">
      <a
        href={`tel:+91${SUPPORT_PHONE}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        <Phone className="h-4 w-4" /> Call us anytime
      </a>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
      >
        <Mail className="h-4 w-4" /> Email us
      </a>
    </div>
    <div className="mt-6 flex items-center justify-center gap-3 text-xs">
      <button type="button" onClick={onReset} className="text-brand-600 hover:underline">
        Submit another service
      </button>
      <span className="text-slate-300">·</span>
      <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-600">
        <Briefcase className="h-3 w-3" /> Back to home
      </Link>
    </div>
  </div>
);
