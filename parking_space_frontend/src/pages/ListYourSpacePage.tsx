import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';
import { CITIES } from '@/pages/ExplorePage';
import { cn } from '@/lib/cn';

interface LeadForm {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  slotsApprox?: string;
  notes?: string;
}

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Steady, predictable revenue',
    desc: 'Hourly, daily, and monthly bookings keep your bays earning around the clock.',
  },
  {
    icon: Sparkles,
    title: 'Zero setup cost',
    desc: 'Listing is free. You set the price and accept the bookings you want.',
  },
  {
    icon: Shield,
    title: 'Verified drivers only',
    desc: 'KYC-checked customers, vehicle records, and entry/exit photos for every booking.',
  },
  {
    icon: IndianRupee,
    title: 'Fast payouts',
    desc: 'Settled directly to your bank or UPI — weekly cycle, no minimum threshold.',
  },
];

const STEPS = [
  { n: '1', title: 'Tell us about your space', desc: 'Fill the short form below — 30 seconds.' },
  { n: '2', title: 'Quick verification call',  desc: "Our team rings to confirm details and walk through pricing." },
  { n: '3', title: 'Go live',                   desc: "Your spot shows up on AutoSahay search the same day approval clears." },
];

export const ListYourSpacePage = () => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadForm>({ defaultValues: { city: '' } });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const cityValue = watch('city');

  const submit = useMutation({
    mutationFn: (data: LeadForm) =>
      api.post('/util/vendor-leads', {
        businessName: data.businessName.trim(),
        fullName:     data.fullName.trim(),
        email:        data.email.trim(),
        phone:        data.phone.trim(),
        city:         data.city,
        slotsApprox:  data.slotsApprox ? Number(data.slotsApprox) : undefined,
        notes:        data.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      reset({ city: '' });
    },
    onError: (e) => setSubmitError(errorMessage(e)),
  });

  const onSubmit = (data: LeadForm) => {
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
          className="absolute inset-0 opacity-30 [background:radial-gradient(800px_400px_at_10%_0%,rgba(255,255,255,0.35),transparent_60%),radial-gradient(600px_300px_at_90%_100%,rgba(255,255,255,0.25),transparent_60%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 text-white sm:py-20 lg:grid-cols-[1.1fr,1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
              <Building2 className="h-3.5 w-3.5" /> Earn from your parking
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Got empty parking bays?
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 bg-clip-text text-transparent">
                Turn them into revenue.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
              List your spaces on {BRAND_NAME} and reach drivers actively looking to park in your
              area — by the hour, day, or month. We handle the bookings, payments, and entry/exit
              records. You keep the keys.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <a
                href="#lead-form"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 shadow-lg transition hover:bg-slate-100"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={`tel:+91${SUPPORT_PHONE}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
              >
                <Phone className="h-4 w-4" />
                Call us: +91 {SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
          </div>

          {/* Right column — quick trust strip */}
          <div className="grid grid-cols-2 gap-3 self-center">
            {[
              { v: '12,400+', l: 'Slots listed' },
              { v: '0%',      l: 'Setup cost' },
              { v: '4.8★',    l: 'Vendor rating' },
              { v: 'Weekly',  l: 'Payouts' },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl bg-white/10 p-5 backdrop-blur ring-1 ring-white/15"
              >
                <p className="font-display text-2xl font-bold text-white">{s.v}</p>
                <p className="mt-1 text-xs text-white/70">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Why partner with us</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            The easiest way to put your bays to work
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 ring-1 ring-brand-500/20 transition group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-slate-200/60 bg-slate-50 py-14 dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Three steps</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white shadow">
                  {s.n}
                </span>
                <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD CAPTURE FORM */}
      <section id="lead-form" className="mx-auto max-w-3xl px-4 py-14">
        {submitted ? (
          <SuccessCard onReset={() => setSubmitted(false)} />
        ) : (
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-brand-50/40 px-6 py-5 dark:border-slate-800 dark:bg-brand-500/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Lead form</p>
              <h2 className="mt-1 font-display text-xl font-bold">Tell us about your space</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Fill these details and a team member will reach out within 24 hours to walk you
                through the next steps.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business / property name" error={errors.businessName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.businessName && 'border-rose-500')}
                    placeholder="e.g. Cyber Towers Parking"
                    {...register('businessName', {
                      required: 'Required',
                      minLength: { value: 2, message: 'Too short' },
                    })}
                  />
                </Field>

                <Field label="Your full name" error={errors.fullName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.fullName && 'border-rose-500')}
                    placeholder="Owner / point of contact"
                    {...register('fullName', {
                      required: 'Required',
                      minLength: { value: 2, message: 'Too short' },
                    })}
                  />
                </Field>

                <Field label="Phone" error={errors.phone?.message}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    className={cn('input mt-1', errors.phone && 'border-rose-500')}
                    placeholder="10-digit mobile"
                    {...register('phone', {
                      required: 'Required',
                      minLength: { value: 7, message: 'Too short' },
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

                <Field label="Approx. number of slots" hint="Optional">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    className="input mt-1"
                    placeholder="e.g. 25"
                    {...register('slotsApprox')}
                  />
                </Field>
              </div>

              <Field label="Anything else we should know?" hint="Optional">
                <textarea
                  rows={3}
                  className="input mt-1"
                  placeholder="Type of space (open / covered / basement), operating hours, etc."
                  {...register('notes')}
                />
              </Field>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center gap-2"
                disabled={isSubmitting || submit.isPending}
              >
                {submit.isPending ? 'Submitting…' : (
                  <>
                    Submit details <ArrowRight className="h-4 w-4" />
                  </>
                )}
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
    <h2 className="mt-4 font-display text-2xl font-bold">Thanks — we'll be in touch</h2>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      Your details are with our partnerships team. Expect a call from us within 24 hours.
    </p>

    <div className="mx-auto mt-6 grid max-w-md gap-2 sm:grid-cols-2">
      <a
        href={`tel:+91${SUPPORT_PHONE}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        <Phone className="h-4 w-4" />
        Call us anytime
      </a>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
      >
        <Mail className="h-4 w-4" />
        Email us
      </a>
    </div>

    <div className="mt-6 flex items-center justify-center gap-3 text-xs">
      <button type="button" onClick={onReset} className="text-brand-600 hover:underline">
        Submit another property
      </button>
      <span className="text-slate-300">·</span>
      <Link to="/" className="text-slate-500 hover:text-brand-600">
        Back to home
      </Link>
    </div>
  </div>
);
